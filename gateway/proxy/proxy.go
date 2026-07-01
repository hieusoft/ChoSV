package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
)

func ReverseProxy(target string) gin.HandlerFunc {
	remote, _ := url.Parse(target)
	proxy := httputil.NewSingleHostReverseProxy(remote)

	return func(c *gin.Context) {
		proxy.Director = func(req *http.Request) {
			req.Header = c.Request.Header
			req.Host = remote.Host
			req.URL.Scheme = remote.Scheme
			req.URL.Host = remote.Host
			req.URL.Path = c.Request.URL.Path
			req.URL.RawQuery = c.Request.URL.RawQuery

			// Forward user info from gateway auth
			if userID, exists := c.Get("user_id"); exists {
				req.Header.Set("X-User-Id", userID.(string))
			}
			if role, exists := c.Get("user_role"); exists {
				req.Header.Set("X-User-Role", role.(string))
			}
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}
