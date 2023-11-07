/* eslint no-unused-vars: off */
/* eslint no-global-assign: off */
/* global systemDictionary */
'use strict';

systemDictionary = {
	'boschindego adapter settings': {
		'en': 'Adapter settings for boschindego',
		'de': 'Adaptereinstellungen für boschindego',
	},
	'code': {
		'en': 'Authentication code',
		'de': 'Authentifizierungscode',
	},
	'serial': {
		'en': 'Serial number',
		'de': 'Seriennummer',
	},
	"deepSleepAtNight": {
		"en": "Don't wake up mower during night time (22h - 8h) for status checks",
		"de": "Mäher während der Nachtzeit (22h - 8h) nicht für Statusprüfungen aufwecken",
	},
	"hint_code": {
		"en": "To obtain the authentication code, follow <a target='_blank' href='https://prodindego.b2clogin.com/prodindego.onmicrosoft.com/b2c_1a_signup_signin/oauth2/v2.0/authorize?redirect_uri=com.bosch.indegoconnect://login&client_id=65bb8c9d-1070-4fb4-aa95-853618acc876&response_type=code&scope=openid%20offline_access%20https://prodindego.onmicrosoft.com/indego-mobile-api/Indego.Mower.User'>this link</a>.<br>It will redirect you to the SingleKey ID login page. The adapter does not gain any knowledge of your username or password!<br>Open the developer tools in your browser before entering your access data. Usually, you can do this by pressing F12.<br>After you have entered your access data, the authentication code will be displayed in the developer tools window.<br>Copy the code provided there and paste it here.",
		"de": "Um an den Authentifizierungscode zu gelangen, folge <a target='_blank' href='https://prodindego.b2clogin.com/prodindego.onmicrosoft.com/b2c_1a_signup_signin/oauth2/v2.0/authorize?redirect_uri=com.bosch.indegoconnect://login&client_id=65bb8c9d-1070-4fb4-aa95-853618acc876&response_type=code&scope=openid%20offline_access%20https://prodindego.onmicrosoft.com/indego-mobile-api/Indego.Mower.User'>diesem Link</a>.<br>Er leitet Dich auf die Anmeldeseite von SingleKey ID. Der Adapter erlangt dabei keine Kenntnis über Deinen Benutzernamen oder Kennwort!<br>Öffne vor der Eingabe Deiner Zugansdaten die Developer-Tools im Browser. Normalerweise geht das mit der Taste F12.<br>Nachdem Du Deine Zugansdaten eingegeben hast, wird der Authentifizierungscode im Fenster der Developer-Tools angezeigt.<br>Kopiere den dort hinterlegten Code und füge ihn hier ein.",
	},
	"hint serial": {	
		"en": "You can find the serial number on the back of the mower or in the app under 'Settings' -> 'Mower' -> 'About' -> 'Serial number'",
		"de": "Die Seriennummer finden Sie auf der Rückseite des Mähers oder in der App unter 'Einstellungen' -> 'Mäher' -> 'Info' -> 'Seriennummer'",
	}
};