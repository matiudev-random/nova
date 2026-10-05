package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// Avisos de Nova. Cada hora (a los :07) mira `nova_items` de cada usuario con
// dispositivos suscriptos y manda un push con lo que ya venció. Cada vencimiento
// se avisa una sola vez: `notifiedDue` guarda la fecha avisada, y cuando se marca
// hecho o se pospone la fecha cambia y el aviso vuelve a quedar pendiente.

const (
	subsCollection  = "nova_push_subs"
	itemsCollection = "nova_items"
	// Contacto que ven los servicios de push (Google, Apple) si algo anda mal.
	vapidSubject = "mailto:matiiasalberto.22@gmail.com"
	firstHour    = 9
	lastHour     = 21
)

type vapidKeys struct {
	Public  string `json:"publicKey"`
	Private string `json:"privateKey"`
}

var (
	vapidOnce sync.Once
	vapid     vapidKeys
	vapidErr  error
)

// Las claves VAPID se generan la primera vez y quedan en el directorio de datos.
// La privada nunca sale del servidor. Si cambian, todos los dispositivos tienen
// que volver a suscribirse (la app lo hace sola al notar la clave nueva).
func loadVapid(app core.App) (vapidKeys, error) {
	vapidOnce.Do(func() {
		path := filepath.Join(app.DataDir(), "nova_vapid.json")
		if raw, err := os.ReadFile(path); err == nil {
			vapidErr = json.Unmarshal(raw, &vapid)
			return
		}
		priv, pub, err := webpush.GenerateVAPIDKeys()
		if err != nil {
			vapidErr = err
			return
		}
		vapid = vapidKeys{Public: pub, Private: priv}
		raw, _ := json.Marshal(vapid)
		vapidErr = os.WriteFile(path, raw, 0o600)
	})
	return vapid, vapidErr
}

type subscriptionBody struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	TZ string `json:"tz"`
}

func registerNovaPush(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		if _, err := loadVapid(se.App); err != nil {
			return fmt.Errorf("nova push: claves VAPID: %w", err)
		}

		g := se.Router.Group("/api/nova/push")

		g.GET("/key", func(e *core.RequestEvent) error {
			return e.JSON(http.StatusOK, map[string]string{"publicKey": vapid.Public})
		})

		// Alta o actualización de este dispositivo. Va por endpoint: si el mismo
		// navegador se suscribió con otra cuenta, pasa a ser de la cuenta actual.
		g.POST("/subscription", func(e *core.RequestEvent) error {
			var body subscriptionBody
			if err := e.BindBody(&body); err != nil || body.Endpoint == "" || body.Keys.P256dh == "" || body.Keys.Auth == "" {
				return e.BadRequestError("Suscripción inválida.", err)
			}
			if _, err := time.LoadLocation(body.TZ); err != nil || body.TZ == "" {
				body.TZ = "UTC"
			}
			rec, err := e.App.FindFirstRecordByData(subsCollection, "endpoint", body.Endpoint)
			if err != nil {
				col, err := e.App.FindCollectionByNameOrId(subsCollection)
				if err != nil {
					return e.InternalServerError("Falta la colección "+subsCollection+".", err)
				}
				rec = core.NewRecord(col)
				rec.Set("endpoint", body.Endpoint)
			}
			rec.Set("user", e.Auth.Id)
			rec.Set("p256dh", body.Keys.P256dh)
			rec.Set("auth", body.Keys.Auth)
			rec.Set("tz", body.TZ)
			if err := e.App.Save(rec); err != nil {
				return e.InternalServerError("No pude guardar la suscripción.", err)
			}
			return e.NoContent(http.StatusNoContent)
		}).Bind(apis.RequireAuth("users"))

		g.DELETE("/subscription", func(e *core.RequestEvent) error {
			var body subscriptionBody
			if err := e.BindBody(&body); err != nil || body.Endpoint == "" {
				return e.BadRequestError("Falta el endpoint.", err)
			}
			rec, err := e.App.FindFirstRecordByData(subsCollection, "endpoint", body.Endpoint)
			if err == nil && rec.GetString("user") == e.Auth.Id {
				if err := e.App.Delete(rec); err != nil {
					return e.InternalServerError("No pude borrar la suscripción.", err)
				}
			}
			return e.NoContent(http.StatusNoContent)
		}).Bind(apis.RequireAuth("users"))

		// Para probar sin esperar al cron. Solo superusuarios.
		g.POST("/run", func(e *core.RequestEvent) error {
			return e.JSON(http.StatusOK, sendDue(e.App, time.Now()))
		}).Bind(apis.RequireSuperuserAuth())

		return se.Next()
	})

	app.Cron().MustAdd("novaPushDue", "7 * * * *", func() {
		r := sendDue(app, time.Now())
		if r.Users > 0 || r.Removed > 0 || len(r.Errors) > 0 {
			app.Logger().Info("nova push", "users", r.Users, "sent", r.Sent, "removed", r.Removed, "errors", r.Errors)
		}
	})
}

type runResult struct {
	Users   int      `json:"users"`
	Sent    int      `json:"sent"`
	Removed int      `json:"removed"`
	Errors  []string `json:"errors"`
}

type dueItem struct {
	rec   *core.Record
	dueAt string
}

// Vencimiento = última vez + intervalo + lo pospuesto (fechas "solo día").
func dueDate(item *core.Record) (string, bool) {
	last, err := time.Parse(time.DateOnly, item.GetString("lastDoneAt"))
	if err != nil {
		return "", false
	}
	days := item.GetInt("intervalDays") + item.GetInt("postponeDays")
	return last.AddDate(0, 0, days).Format(time.DateOnly), true
}

func sendDue(app core.App, now time.Time) runResult {
	res := runResult{Errors: []string{}}
	subs, err := app.FindAllRecords(subsCollection)
	if err != nil {
		res.Errors = append(res.Errors, err.Error())
		return res
	}

	byUser := map[string][]*core.Record{}
	for _, s := range subs {
		byUser[s.GetString("user")] = append(byUser[s.GetString("user")], s)
	}

	for userID, userSubs := range byUser {
		// La hora que cuenta es la del dispositivo usado más recientemente.
		latest := userSubs[0]
		for _, s := range userSubs[1:] {
			if s.GetDateTime("updated").Time().After(latest.GetDateTime("updated").Time()) {
				latest = s
			}
		}
		loc, err := time.LoadLocation(latest.GetString("tz"))
		if err != nil {
			loc = time.UTC
		}
		local := now.In(loc)
		if local.Hour() < firstHour || local.Hour() > lastHour {
			continue
		}
		today := local.Format(time.DateOnly)

		items, err := app.FindRecordsByFilter(itemsCollection, "user = {:user} && deleted = false", "", 0, 0, dbx.Params{"user": userID})
		if err != nil {
			res.Errors = append(res.Errors, err.Error())
			continue
		}
		var due []dueItem
		for _, it := range items {
			d, ok := dueDate(it)
			if ok && d <= today && it.GetString("notifiedDue") != d {
				due = append(due, dueItem{it, d})
			}
		}
		if len(due) == 0 {
			continue
		}
		res.Users++

		payload, _ := json.Marshal(duePayload(due))
		delivered := false
		for _, s := range userSubs {
			status, err := sendPush(s, payload)
			switch {
			case err == nil && status < 300:
				res.Sent++
				delivered = true
			case status == http.StatusNotFound || status == http.StatusGone:
				// La suscripción ya no existe en el navegador. Se limpia.
				if err := app.Delete(s); err == nil {
					res.Removed++
				}
			default:
				res.Errors = append(res.Errors, fmt.Sprintf("sub %s: status %d %v", s.Id, status, err))
			}
		}

		// Si no llegó a ningún dispositivo, se reintenta en la próxima vuelta.
		if !delivered {
			continue
		}
		for _, d := range due {
			d.rec.Set("notifiedDue", d.dueAt)
			if err := app.Save(d.rec); err != nil {
				res.Errors = append(res.Errors, err.Error())
			}
		}
	}
	return res
}

func duePayload(due []dueItem) map[string]string {
	names := make([]string, len(due))
	for i, d := range due {
		names[i] = d.rec.GetString("name")
	}
	p := map[string]string{"tag": "nova-due", "url": "/"}
	if len(names) == 1 {
		p["title"] = names[0]
		p["body"] = "Ya toca. Abrí Nova para marcarlo."
	} else {
		p["title"] = fmt.Sprintf("%d cosas ya tocan", len(names))
		p["body"] = strings.Join(names[:len(names)-1], ", ") + " y " + names[len(names)-1]
	}
	return p
}

func sendPush(sub *core.Record, payload []byte) (int, error) {
	resp, err := webpush.SendNotification(payload, &webpush.Subscription{
		Endpoint: sub.GetString("endpoint"),
		Keys:     webpush.Keys{P256dh: sub.GetString("p256dh"), Auth: sub.GetString("auth")},
	}, &webpush.Options{
		Subscriber:      vapidSubject,
		VAPIDPublicKey:  vapid.Public,
		VAPIDPrivateKey: vapid.Private,
		TTL:             60 * 60 * 12,
		// Android entrega al momento en vez de esperar a que el teléfono despierte.
		Urgency: webpush.UrgencyHigh,
	})
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return resp.StatusCode, fmt.Errorf("push service: %s", resp.Status)
	}
	return resp.StatusCode, nil
}
