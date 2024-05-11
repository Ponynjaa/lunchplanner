export default {
	"realm": "Xpublisher",
	"auth-server-url": "https://keycloak.oliverswienty.de",
	"ssl-required": "external",
	"resource": "lunchplanner",
	"verify-token-audience": true,
	"credentials": {
		"secret": process.env.KC_CLIENT_SECRET
	},
	"use-resource-role-mappings": true,
	"confidential-port": 0
}
