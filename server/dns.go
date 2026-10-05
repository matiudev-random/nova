package main

import (
	"context"
	"net"
	"os"
	"time"
)

// En Android (Termux) no existe /etc/resolv.conf y el resolver de Go termina
// preguntando a localhost, así que no resuelve nada (ni fcm.googleapis.com).
// En ese caso se usan DNS públicos.
func useFallbackDNS() {
	if _, err := os.Stat("/etc/resolv.conf"); err == nil {
		return
	}
	servers := []string{"1.1.1.1:53", "8.8.8.8:53"}
	net.DefaultResolver = &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			d := net.Dialer{Timeout: 5 * time.Second}
			var lastErr error
			for _, s := range servers {
				conn, err := d.DialContext(ctx, network, s)
				if err == nil {
					return conn, nil
				}
				lastErr = err
			}
			return nil, lastErr
		},
	}
}
