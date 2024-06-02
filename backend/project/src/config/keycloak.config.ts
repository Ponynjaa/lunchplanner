import KeycloakConnect from "keycloak-connect";

const kcConfig: KeycloakConnect.KeycloakConfig = {
	"realm": "Xpublisher",
	"auth-server-url": "https://keycloak.oliverswienty.de",
	"ssl-required": "external",
	"resource": "lunchplanner",
	"confidential-port": 0,
	"bearer-only": true
};

export const keycloak = new KeycloakConnect({}, kcConfig);
