import KeycloakConnect from "keycloak-connect";
import KcAdminClient from "@keycloak/keycloak-admin-client";

export const kcConfig: KeycloakConnect.KeycloakConfig = {
	"realm": "Xpublisher",
	"auth-server-url": "https://keycloak.oliverswienty.de",
	"ssl-required": "external",
	"resource": "lunchplanner",
	"confidential-port": 0,
	"bearer-only": true
};

export const keycloak = new KeycloakConnect({}, kcConfig);
export const kcAdmin = new KcAdminClient({
	baseUrl: kcConfig["auth-server-url"],
	realmName: 'master'
});
