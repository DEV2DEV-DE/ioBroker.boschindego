'use strict';

/*
 * Created with @iobroker/create-adapter v2.5.0
 */

const utils = require('@iobroker/adapter-core');
const axios = require('axios').default;

const clientId = '65bb8c9d-1070-4fb4-aa95-853618acc876';
const scope = 'openid%20offline_access%20https://prodindego.onmicrosoft.com/indego-mobile-api/Indego.Mower.User';
const codeVerifier = 'code_verifier=ThisIsntRandomButItNeedsToBe43CharactersLong';
const redirect = 'com.bosch.indegoconnect://login';
const commandUri = 'https://api.indego-cloud.iot.bosch-si.com/api/v1/';
const tokenBaseUri = 'https://prodindego.b2clogin.com/prodindego.onmicrosoft.com/b2c_1a_signup_signin/oauth2/v2.0/token';
const tokenRequestUri = `${tokenBaseUri}?grant_type=authorization_code&client_id=${clientId}&scope=${scope}&code=`;
const tokenRefreshUri = `${tokenBaseUri}?grant_type=refresh_token&client_id=${clientId}&scope=${scope}&refresh_token=`;
const userAgent = 'Mozilla/5.0 (iPhone13,2; U; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/15E148 Safari/602.1';

const refreshModes = {
	normal: 1,
	longPoll: 2,
	deepSleep: 3
};

const credentials = {
	access_token: '',
	valid_until: 0,
	refresh_token: '',
	context_id: '',
	resource: ''
};

let connected = false;
let alm_sn;
let currentStateCode = 0;
let refreshMode = refreshModes.normal;
let automaticStateRefresh = true;
let botIsMoving = false;
let requestRunning = false;
let requestGetOperationData = false;
let requestGetMachineData = false;
let requestGetAlerts = false;
let requestDeleteAlerts = false;
let requestGetMap = false;
let firstRun = true;
let notMovingCount = 0;
let interval1;
let interval2;
let interval3;
let interval4;

const stateCodes = [
	{id: 0, status: 'Reading status', moving: false},
	{id: 257, status: 'Charging', moving: false},
	{id: 258, status: 'Docked', moving: false},
	{id: 259, status: 'Docked - Software update', moving: false},
	{id: 260, status: 'Docked - Charging', moving: false},
	{id: 261, status: 'Docked', moving: false},
	{id: 262, status: 'Docked - Loading map', moving: false},
	{id: 263, status: 'Docked - Saving map', moving: false},
	{id: 266, status: 'Docked', moving: false},
	{id: 512, status: 'Leaving dock', moving: true},
	{id: 513, status: 'Mowing', moving: true},
	{id: 514, status: 'Relocalising', moving: true},
	{id: 515, status: 'Loading map', moving: true},
	{id: 516, status: 'Learning lawn', moving: true},
	{id: 517, status: 'Paused', moving: false},
	{id: 518, status: 'Border cut', moving: true},
	{id: 519, status: 'Idle in lawn', moving: false},
	{id: 520, status: 'Learning lawn', moving: true},
	{id: 768, status: 'Returning to Dock', moving: true},
	{id: 769, status: 'Returning to Dock', moving: true},
	{id: 770, status: 'Returning to Dock', moving: true},
	{id: 771, status: 'Returning to Dock - Battery low', moving: true},
	{id: 772, status: 'Returning to dock - Calendar timeslot ended', moving: true},
	{id: 773, status: 'Returning to dock - Battery temp range', moving: true},
	{id: 774, status: 'Returning to dock', moving: true},
	{id: 775, status: 'Returning to dock - Lawn complete', moving: true},
	{id: 776, status: 'Returning to dock - Relocalising', moving: true},
	{id: 1005, status: 'Connection to dockingstation failed', moving: false},
	{id: 1025, status: 'Diagnostic mode', moving: false},
	{id: 1026, status: 'EOL Mode', moving: false},
	{id: 1027, status: 'Service Requesting Status', moving: false},
	{id: 1038, status: 'Mower immobilized', moving: false},
	{id: 1281, status: 'Software update', moving: false},
	{id: 1537, status: 'Low power mode', moving: false},
	{id: 64513, status: 'Sleeping', moving: false},
	{id: 99999, status: 'Offline', moving: false},
];

const modelNames = {
	'3600HA2300': 'Indego 1000',
	'3600HA2301': 'Indego 1200',
	'3600HA2302': 'Indego 1100',
	'3600HA2303': 'Indego 13C',
	'3600HA2304': 'Indego 10C',
	'3600HB0100': 'Indego 350',
	'3600HB0101': 'Indego 400',
	'3600HB0102': 'Indego S+ 350 1gen',
	'3600HB0103': 'Indego S+ 400 1gen',
	'3600HB0105': 'Indego S+ 350 2gen',
	'3600HB0106': 'Indego S+ 400 2gen',
	'3600HB0302': 'Indego S+ 500',
	'3600HB0301': 'Indego M+ 700 1gen',
	'3600HB0303': 'Indego M+ 700 2gen',
};


class Boschindego extends utils.Adapter {

	constructor(options = {}) {
		super({
			...options,
			name: 'boschindego',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	// Is called when databases are connected and adapter received configuration.
	async onReady() {
		// Create all states needed for the adapter
		await this.createObjectStructure();

		// Initialize your adapter here
		const refreshConfig = await this.getStateAsync('config.automatic_state_refresh');
		automaticStateRefresh = refreshConfig ? !!refreshConfig.val : automaticStateRefresh;
		if (this.config.code && this.config.serial) {
			this.connect(this.config.code, this.config.serial);
		} else {
			this.setForeignState('system.adapter.' + this.namespace + '.alive', false);
			this.log.error('Please provide your authentication code and serial number in the adapter settings');
		}

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates('commands.mow');
		this.subscribeStates('commands.pause');
		this.subscribeStates('commands.go_home');
		this.subscribeStates('commands.refresh_state');
		this.subscribeStates('commands.clear_alerts');
		this.subscribeStates('config.automatic_state_refresh');

		// setup recurring actions
		interval1 = setInterval(() => {
			if (refreshMode == refreshModes.normal && automaticStateRefresh) {
				this.refreshState(false);
			}
			if (botIsMoving == false) {
				refreshMode = refreshModes.longPoll;
				if (this.isNightTime()) {
					refreshMode = refreshModes.deepSleep;
				} else {
					refreshMode = refreshModes.longPoll;
				}
			} else {
				refreshMode = refreshModes.normal;
			}
		}, 20000); // 20 seconds
		interval2 = setInterval(() => {
			if (refreshMode == refreshModes.longPoll && automaticStateRefresh) {
				this.refreshState(false);
			}
		}, 60000); // 1 minute
		interval3 = setInterval(() => {
			if (refreshMode == refreshModes.deepSleep && this.config.deepSleepAtNight == false && automaticStateRefresh) {
				this.refreshState(false);
			}
		}, 1800000); // 30 minutes
		interval4 = setInterval(() => {
			if (connected) {
				this.refreshAccessToken();
			}
		}, 21600000); // 6 hours
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	onUnload(callback) {
		try {
			clearInterval(interval1);
			clearInterval(interval2);
			clearInterval(interval3);
			clearInterval(interval4);
			callback();
		} catch (e) {
			callback();
		}
	}

	onStateChange(id, state) {
		if (state) {
			// The state was changed
			if (state.val) {
				this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
				if (id.includes('mow')) this.mow();
				if (id.includes('pause'))  this.pause();
				if (id.includes('go_home')) this.goHome();
				if (id.includes('refresh_state')) this.refreshState(true);
				if (id.includes('clear_alerts')) this.clearAlerts();
				if (id.includes('automatic_state_refresh')) {
					automaticStateRefresh = !!state.val;
					if (automaticStateRefresh) refreshMode = refreshModes.normal;
				}
			}
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	async refreshAccessToken() {
		try {
			const requestUri = `${tokenRefreshUri}${credentials.refresh_token}&redirect_uri=${redirect}`;
			const response = await axios.get(requestUri);
			this.log.debug('Response: ' + JSON.stringify(response.data));
			credentials.access_token = response.data.access_token;
			credentials.valid_until = response.data.expires_on;
			credentials.refresh_token = response.data.refresh_token;
			credentials.resource = response.data.resource;
			this.setStateAsync('config.access_token', { val: credentials.access_token, ack: true });
			this.setStateAsync('config.valid_until', { val: credentials.valid_until, ack: true });
			this.setStateAsync('config.refresh_token', { val: credentials.refresh_token, ack: true });
			this.setStateAsync('config.resource', { val: credentials.resource, ack: true });
			this.log.debug('Access token has been refreshed');
		} catch (error) {
			console.error('Error in refreshAccessToken: ', error);
			this.setForeignState('system.adapter.' + this.namespace + '.alive', false);
			this.setStateAsync('info.connection', { val: false, ack: true });
			this.log.error('Error refreshing access token: ' + error);
		}
	}

	async connect(code, serial) {
		try {
			if (!connected) {
				const token = await this.getStateAsync('config.access_token');
				const access_token = (token && token != null) ? token.val : '';
				const valid = await this.getStateAsync('config.valid_until');
				const valid_until = (valid && valid.val != null) ? Number(valid.val) * 1000 : 0;
				const refresh = await this.getStateAsync('config.refresh_token');
				const refresh_token = (refresh && refresh.val != null) ? refresh.val : '';
				const now = new Date().getTime();
				// if token is still valid, use saved token to connect
				if (access_token && refresh_token && valid_until > now) {
					this.log.debug('Connecting with saved token');
					const res = await this.getStateAsync('config.resource');
					const resource = (res && res.val != null) ? res.val : '';
					credentials.access_token = String(access_token);
					credentials.valid_until = valid_until;
					credentials.refresh_token = String(refresh_token);
					credentials.resource = String(resource);
					alm_sn = serial;
					connected = true;
					this.setStateAsync('info.connection', { val: true, ack: true });
					this.setForeignState('system.adapter.' + this.namespace + '.alive', true);
				} else { // token no longer valid. Get a new one
					const requestUri = `${tokenRequestUri}${code}&redirect_uri=${redirect}&${codeVerifier}`;
					this.log.debug('Getting access token from url: ' + requestUri);
					const response = await axios.get(requestUri);
					credentials.access_token = response.data.access_token;
					credentials.valid_until = response.data.expires_on;
					credentials.refresh_token = response.data.refresh_token;
					credentials.resource = response.data.resource;
					this.setStateAsync('config.access_token', { val: credentials.access_token, ack: true });
					this.setStateAsync('config.valid_until', { val: credentials.valid_until, ack: true });
					this.setStateAsync('config.refresh_token', { val: credentials.refresh_token, ack: true });
					this.setStateAsync('config.resource', { val: credentials.resource, ack: true });
					this.log.debug('Connected to Bosch Indego API');
					this.log.debug(JSON.stringify(response.data));
					alm_sn = serial;
					connected = true;
					this.setStateAsync('info.connection', { val: true, ack: true });
					this.setForeignState('system.adapter.' + this.namespace + '.alive', true);
				}
			}
		} catch (error) {
			this.log.error('Error connecting Bosch API: ' + error);
		}
	}

	async mow() {
		try {
			await this.setStateAsync('commands.mow', { val: false, ack: true });
			this.log.info('mow command sent');
			const requestUri = `${commandUri}alms/${alm_sn}/state`;
			const params = {
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${credentials.access_token}`,
					'User-Agent': userAgent,
					'x-im-context-id': credentials.resource
				},
				data: { state: 'mow' }
			};
			axios.put(requestUri, params);
		} catch (error) {
			this.log.error('error in mow request: ' + error);
		}
	}

	async goHome() {
		try {
			await this.setStateAsync('commands.go_home', { val: false, ack: true });
			this.log.info('return to dock command sent');
			const requestUri = `${commandUri}alms/${alm_sn}/state`;
			const params = {
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${credentials.access_token}`,
					'User-Agent': userAgent,
					'x-im-context-id': credentials.resource
				},
				data: { state: 'returnToDock' }
			};
			axios.put(requestUri, params);
		} catch (error) {
			this.log.error('error in returnToDock request: ' + error);
		}
	}

	async pause() {
		try {
			await this.setStateAsync('commands.pause', { val: false, ack: true });
			this.log.info('pause command sent');
			const requestUri = `${commandUri}alms/${alm_sn}/state`;
			const params = {
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${credentials.access_token}`,
					'User-Agent': userAgent,
					'x-im-context-id': credentials.resource
				},
				data: { state: 'pause' }
			};
			axios.put(requestUri, params);
		} catch (error) {
			this.log.error('error in pause request: ' + error);
		}
	}

	async refreshState(force) {
		this.log.debug('Refreshing states for mower');
		this.log.debug('Connected: ' + connected);
		this.log.debug('RequestRunning: ' + requestRunning);
		this.log.debug('BotIsMoving: ' + botIsMoving);
		this.log.debug('CurrentStateCode: ' + currentStateCode);

		await this.setStateAsync('commands.refresh_state', { val: false, ack: true });
		if (connected && (botIsMoving || force || (currentStateCode == 257 || currentStateCode == 260))) { // if bot moves or is charging, get data. Prevents waking up the bot
			this.getOperatingData();
		}
		if (connected && (!requestRunning || force)) {
			requestRunning = true;
			let timeout = 30000;
			const last = (currentStateCode == undefined) ? 0 : currentStateCode;
			let forceUrl = '';
			if (refreshMode == refreshModes.normal || force) {
				this.log.debug('state - force - refreshMode: ' + refreshMode);
				forceUrl = '?cached=false&force=true';
			} else {
				this.log.debug('refresh state - longPoll - refreshMode: ' + refreshMode);
				timeout = 3650000;
				forceUrl = `?longpoll=true&timeout=3600&last=${last}`;
			}
			try {
				const requestUri = `${commandUri}alms/${alm_sn}/state${forceUrl}`;
				const res = await axios.get(requestUri, {
					headers: {
						Authorization: `Bearer ${credentials.access_token}`,
						'User-Agent': userAgent
					},
					timeout: timeout
				});
				requestRunning = false;
				this.log.debug('{id: State Data] ' + JSON.stringify(res.data));
				await this.setStateAsync('state.state', { val: res.data.state, ack: true });
				await this.setStateAsync('state.map_update_available', { val: res.data.map_update_available, ack: true });
				if (typeof (res.data.mowed) !== 'undefined') {
					await this.setStateAsync('state.mowed', { val: res.data.mowed, ack: true });
					await this.setStateAsync('state.mowmode', { val: res.data.mowmode, ack: true });
					await this.setStateAsync('state.xPos', { val: res.data.xPos, ack: true });
					await this.setStateAsync('state.yPos', { val: res.data.yPos, ack: true });
					await this.setStateAsync('state.runtime.total.operate', { val: res.data.runtime.total.operate, ack: true });
					await this.setStateAsync('state.runtime.total.charge', { val: res.data.runtime.total.charge, ack: true });
					await this.setStateAsync('state.runtime.session.operate', { val: res.data.runtime.session.operate, ack: true });
					await this.setStateAsync('state.runtime.session.charge', { val: res.data.runtime.session.charge, ack: true });
					await this.setStateAsync('state.config_change', { val: res.data.config_change, ack: true });
					await this.setStateAsync('state.mow_trig', { val: res.data.mow_trig, ack: true });
				}
				await this.setStateAsync('state.mapsvgcache_ts', { val: res.data.mapsvgcache_ts, ack: true });
				await this.setStateAsync('state.svg_xPos', { val: res.data.svg_xPos, ack: true });
				await this.setStateAsync('state.svg_yPos', { val: res.data.svg_yPos, ack: true });
				let stateText = `${res.data.state} - state unknown`;
				this.log.debug('Current state: ' + res.data.state);
				// try to find matching state in stateCodes
				const state = stateCodes.find (state => state.id == res.data.state);
				if (state) {
					stateText = state.status;
					botIsMoving = state.moving;
					notMovingCount = (state.moving) ? 0 : notMovingCount++;
					if (botIsMoving && !firstRun || notMovingCount == 0) {
						this.log.debug((state.moving) ? 'bot is moving' : 'bot is stopped' + ', update map');
						await this.getMap();
						this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
					}
				} else {
					this.log.warn(stateText + '. Please check the state of the mower in your app and report both to the adapter developer');
				}
				this.getAlerts();
				await this.setStateAsync('state.stateText', { val: stateText, ack: true });
				this.stateCodeChange(res.data.state);
				if (firstRun) {
					firstRun = false;
					await this.getMap();
					this.createMapWithIndego(res.data.svg_xPos, res.data.svg_yPos);
				}
			} catch (err) {
				this.log.debug('Error in state request: ' + err);
				requestRunning = false;
				if ((typeof err.response !== 'undefined' && err.response.status == 504) || (typeof err.code !== 'undefined' && err.code == 'ECONNRESET')) {
					// expected behavior by longpoll requests
					this.log.debug('planned longpoll timeout');
				}
			}
		} else if (requestRunning == true) {
			this.log.debug('longpoll request running');
		}
	}

	async getMachineData() {
		if (!requestGetMachineData) {
			this.log.debug('Request API for machine data');
			requestGetMachineData = true;
			try {
				const requestUri =  `${commandUri}alms/${alm_sn}`;
				const res = await axios.get(requestUri, {
					headers: {
						Authorization: `Bearer ${credentials.access_token}`,
						'User-Agent': userAgent
					}
				});
				this.log.debug('[Machine Data] ' + JSON.stringify(res.data));
				requestGetMachineData = false;
				await this.setStateAsync('machine.alm_sn', { val: res.data.alm_sn, ack: true });
				await this.setStateAsync('machine.alm_mode', { val: res.data.alm_mode, ack: true });
				await this.setStateAsync('machine.service_counter', { val: res.data.service_counter, ack: true });
				await this.setStateAsync('machine.needs_service', { val: res.data.needs_service, ack: true });
				await this.setStateAsync('machine.bare_tool_number', { val: res.data.bareToolnumber, ack: true });
				await this.setStateAsync('machine.model', { val: modelNames[res.data.bareToolnumber], ack: true });
				await this.setStateAsync('machine.alm_firmware_version', { val: res.data.alm_firmware_version, ack: true });
			} catch (error) {
				this.log.error('error in machine request: ' + error);
				requestGetMachineData = false;
			}
		} else {
			this.log.debug('skipped - machine request still running');
		}
	}

	async getOperatingData() {
		if (!requestGetOperationData) {
			this.log.debug('Request API for operating data');
			requestGetOperationData = true;
			try {
				const requestUri =  `${commandUri}alms/${alm_sn}/operatingData`;
				const res = await axios.get(requestUri, {
					headers: {
						Authorization: `Bearer ${credentials.access_token}`,
						'User-Agent': userAgent
					}
				});
				this.log.debug('[Operating Data] ' + JSON.stringify(res.data));
				requestGetOperationData = false;
				await this.setStateAsync('operationData.battery.voltage', { val: res.data.battery.voltage, ack: true });
				await this.setStateAsync('operationData.battery.cycles', { val: res.data.battery.cycles, ack: true });
				await this.setStateAsync('operationData.battery.discharge', { val: res.data.battery.discharge, ack: true });
				await this.setStateAsync('operationData.battery.ambient_temp', { val: res.data.battery.ambient_temp, ack: true });
				await this.setStateAsync('operationData.battery.battery_temp', { val: res.data.battery.battery_temp, ack: true });
				await this.setStateAsync('operationData.battery.percent', { val: res.data.battery.percent, ack: true });
				await this.setStateAsync('operationData.garden.signal_id', { val: res.data.garden.signal_id, ack: true });
				await this.setStateAsync('operationData.garden.size', { val: res.data.garden.size, ack: true });
				await this.setStateAsync('operationData.garden.inner_bounds', { val: res.data.garden.inner_bounds, ack: true });
				await this.setStateAsync('operationData.garden.cuts', { val: res.data.garden.cuts, ack: true });
				await this.setStateAsync('operationData.garden.runtime', { val: res.data.garden.runtime, ack: true });
				await this.setStateAsync('operationData.garden.charge', { val: res.data.garden.charge, ack: true });
				await this.setStateAsync('operationData.garden.bumps', { val: res.data.garden.bumps, ack: true });
				await this.setStateAsync('operationData.garden.stops', { val: res.data.garden.stops, ack: true });
				await this.setStateAsync('operationData.garden.last_mow', { val: res.data.garden.last_mow, ack: true });
				await this.setStateAsync('operationData.garden.map_cell_size', { val: res.data.garden.map_cell_size, ack: true });
			} catch (error) {
				this.log.error('error in operatingData request: ' + error);
				requestGetOperationData = false;
			}
		} else {
			this.log.debug('skipped - operating data request still running');
		}
	}

	async clearAlerts() {
		try {
			await this.setStateAsync('commands.clear_alerts', { val: false, ack: true });
			if (!requestDeleteAlerts) {
				requestDeleteAlerts = true;
				this.log.debug('clear alerts');
				const alertArray = await this.getAlerts(false);
				this.log.debug('[Alerts to be deleted] ' + JSON.stringify(alertArray));
				if (alertArray.length > 0) {
					for (const alert of alertArray) {
						this.log.debug('Deleting alert: ' + alert.alert_id);
						const requestUri =  `${commandUri}alerts/${alert.alert_id}`;
						const res = await axios.delete(requestUri, {
							headers: {
								Authorization: `Bearer ${credentials.access_token}`,
								'User-Agent': userAgent
							}
						});
						this.log.debug('Result for DELETE: ' + JSON.stringify(res.data));
					}
					await this.getAlerts(false);
				}
				requestDeleteAlerts = false;
			}
		} catch (error) {
			this.log.error('error in clear alerts request: ' + error);
		}
	}

	async getAlerts(logResult = true) {
		try {
			if (!requestGetAlerts) {
				requestGetAlerts = true;
				this.log.debug('Get alerts');
				const requestUri =  `${commandUri}alerts`;
				const res = await axios.get(requestUri, {
					headers: {
						Authorization: `Bearer ${credentials.access_token}`,
						'User-Agent': userAgent
					}
				});
				if (logResult) this.log.debug('[Alert Data] ' + JSON.stringify(res.data));
				const alertArray = res.data;
				await this.setStateAsync('alerts.list', { val: JSON.stringify(alertArray), ack: true });
				await this.setStateAsync('alerts.count', { val: alertArray.length, ack: true });
				await this.setStateAsync('alerts.error', { val: alertArray.length > 0, ack: true });
				if (alertArray.length > 0) {
					await this.setStateAsync('alerts.last.error_code', { val: alertArray[0].error_code, ack: true });
					await this.setStateAsync('alerts.last.headline', { val: alertArray[0].headline, ack: true });
					await this.setStateAsync('alerts.last.date', { val: alertArray[0].date, ack: true });
					await this.setStateAsync('alerts.last.message', { val: alertArray[0].message, ack: true });
					await this.setStateAsync('alerts.last.flag', { val: alertArray[0].flag, ack: true });
				} else {
					await this.setStateAsync('alerts.last.error_code', { val: '0', ack: true });
					await this.setStateAsync('alerts.last.headline', { val: '', ack: true });
					await this.setStateAsync('alerts.last.date', { val: '', ack: true });
					await this.setStateAsync('alerts.last.message', { val: '', ack: true });
					await this.setStateAsync('alerts.last.flag', { val: '', ack: true });
				}
				requestGetAlerts = false;
				return alertArray;
			} else {
				this.log.debug('skipped - alerts request still running');
			}
		} catch (error) {
			this.log.error('error in alerts request: ' + error);
			requestGetAlerts = false;
			return Promise.reject(error);
		}
	}

	async getMap() {
		try {
			if (!requestGetMap) {
				requestGetMap = true;
				this.log.debug('get map');
				const requestUri = `${commandUri}alms/${alm_sn}/map?cached=false&force=true`;
				const res = await axios.get(requestUri, {
					headers: {
						Authorization: `Bearer ${credentials.access_token}`,
						'User-Agent': userAgent
					}
				});
				await this.setStateAsync('map.mapSVG', { val: res.data, ack: true });
				requestGetMap = false;
				return;
			} else {
				this.log.debug('skipped - get map request still running');
			}
		} catch (error) {
			this.log.error('error in map request: ' + error);
			requestGetMap = false;
		}
	}

	async createMapWithIndego(x, y) {
		try {
			const temp2Map = await this.getStateAsync('map.mapSVG');
			if (temp2Map != null && temp2Map.val != undefined) {
				let tempMap = temp2Map.val.toString();
				tempMap = tempMap.slice(0, tempMap.length - 6);
				tempMap = tempMap + `<circle cx="${x}" cy="${y}" r="6" stroke="black" stroke-width="3" fill="yellow" /></svg>`;
				const tempMapBlack = tempMap.replace('ry="0" fill="#FAFAFA"', 'ry="0" fill="#000" fill-opacity="0.0"');
				await this.setStateAsync('map.mapSVGwithIndego', { val: tempMapBlack, ack: true });
				return(tempMapBlack);
			}
		} catch (error) {
			return(error);
		}
	}

	async stateCodeChange(state) {
		this.log.debug('State: ' + state);
		if (currentStateCode != state) {
			this.getMachineData();
			if (state == 260) {
				firstRun = true; // get current location when returned to dock
			}
		}
		if (botIsMoving == false) { //state == 258
			refreshMode = refreshModes.longPoll;
			if (this.isNightTime()) {
				refreshMode = refreshModes.deepSleep;
			}
		} else {
			refreshMode = refreshModes.normal;
		}
		currentStateCode = state;
	}

	async createObjectStructure() {
		await this.createStateNumber('state.state', 'state');
		await this.createStateString('state.stateText', 'stateText');
		await this.createStateNumber('state.mowmode', 'mowmode');
		await this.createStateNumber('state.xPos', 'xPos');
		await this.createStateNumber('state.yPos', 'yPos');
		await this.createStateNumber('state.runtime.total.operate', 'operate');
		await this.createStateNumber('state.runtime.total.charge', 'charge');
		await this.createStateNumber('state.runtime.session.operate', 'operate');
		await this.createStateNumber('state.runtime.session.charge', 'charge');
		await this.createStateNumber('state.xPos', 'xPos');
		await this.createStateBoolean('state.map_update_available', 'map_update_available');
		await this.createStateNumber('state.mapsvgcache_ts', 'mapsvgcache_ts');
		await this.createStateNumber('state.svg_xPos', 'svg_xPos');
		await this.createStateNumber('state.svg_yPos', 'svg_yPos');
		await this.createStateBoolean('state.config_change', 'config_change');
		await this.createStateBoolean('state.mow_trig', 'mow_trig');
		await this.createStateNumber('state.mowed', 'mowed', '%', 0, 100);
		await this.createStateString('map.mapSVG', 'mapSVG');
		await this.createStateString('map.mapSVGwithIndego', 'mapSVGwithIndego');
		await this.createStateString('alerts.list', 'list');
		await this.createStateNumber('alerts.count', 'count');
		await this.createStateBoolean('alerts.error', 'error');
		await this.createStateString('alerts.last.error_code', 'error_code');
		await this.createStateString('alerts.last.headline', 'headline');
		await this.createStateString('alerts.last.date', 'date');
		await this.createStateString('alerts.last.message', 'message');
		await this.createStateString('alerts.last.flag', 'flag');
		await this.createStateString('machine.alm_sn', 'alm_sn');
		await this.createStateNumber('machine.service_counter', 'service_counter');
		await this.createStateBoolean('machine.needs_service', 'needs_service');
		await this.createStateString('machine.alm_mode', 'alm_mode');
		await this.createStateString('machine.bare_tool_number', 'bareToolnumber');
		await this.createStateString('machine.model', 'model name');
		await this.createStateString('machine.alm_firmware_version', 'alm_firmware_version');
		await this.createStateNumber('operationData.battery.voltage', 'voltage', 'V');
		await this.createStateNumber('operationData.battery.cycles', 'cycles');
		await this.createStateNumber('operationData.battery.discharge', 'discharge', '%');
		await this.createStateNumber('operationData.battery.ambient_temp', 'ambient_temp', '°C');
		await this.createStateNumber('operationData.battery.battery_temp', 'battery_temp', '°C');
		await this.createStateNumber('operationData.battery.percent', 'percent', '%', 0, 100);
		await this.createStateNumber('operationData.garden.signal_id', 'signal_id');
		await this.createStateNumber('operationData.garden.size', 'size', 'm²');
		await this.createStateNumber('operationData.garden.inner_bounds', 'inner_bounds');
		await this.createStateNumber('operationData.garden.cuts', 'cuts');
		await this.createStateNumber('operationData.garden.runtime', 'runtime');
		await this.createStateNumber('operationData.garden.charge', 'charge');
		await this.createStateNumber('operationData.garden.bumps', 'bumps');
		await this.createStateNumber('operationData.garden.stops', 'stops');
		await this.createStateNumber('operationData.garden.last_mow', 'last_mow');
		await this.createStateNumber('operationData.garden.map_cell_size', 'map_cell_size');

		await this.createStateNotExists('config.automatic_state_refresh', 'automatic_state_refresh', 'boolean', 'switch', true, true, '', undefined, undefined, true, 'If true, state is refreshed regularly');
		await this.createStateString('config.access_token', 'access_token');
		await this.createStateNumber('config.valid_until', 'valid_until');
		await this.createStateString('config.refresh_token', 'refresh_token');
		await this.createStateString('config.resource', 'resource');

		await this.createButton('commands.mow', 'mow', 'Start mowing');
		await this.createButton('commands.go_home', 'go_home', 'Return to docking station');
		await this.createButton('commands.pause', 'pause', 'Pause mowing');
		await this.createButton('commands.refresh_state', 'refresh_state', 'Refresh state');
		await this.createButton('commands.clear_alerts', 'clear_alerts', 'Clear alerts');

		await this.createStateNotExists('info.connection', 'Communication with service working', 'boolean', 'indicator.connected', true, false, '', undefined, undefined, false, '');
	}

	async createStateBoolean(aPath, aName, aDef = false, aDesc = '') {
		await this.createStateNotExists(aPath, aName, 'boolean', 'value', true, false, '', undefined, undefined, aDef, aDesc);
	}

	async createStateNumber(aPath, aName, aUnit = '', aMin = -1, aMax = -1, aDef = 0, aDesc = '') {
		await this.createStateNotExists(aPath, aName, 'number', 'value', true, false, aUnit, aMin, aMax, aDef, aDesc);
	}

	async createStateString(aPath, aName, aDef, aDesc) {
		await this.createStateNotExists(aPath, aName, 'string', 'value', true, false, '', undefined, undefined, aDef, aDesc);
	}

	async createButton(aPath, aName, aDesc = '') {
		await this.createStateNotExists(aPath, aName, 'boolean', 'button', false, true, '', undefined, undefined, false, aDesc);
	}

	async createStateNotExists(aPath, aName, aType, aRole, aRead, aWrite, aUnit, aMin, aMax, aDef, aDesc) {
		if (aMax >= 0) {
			await this.setObjectNotExistsAsync(aPath, {
				type: 'state',
				common: {
					name: aName,
					type: aType,
					role: aRole,
					read: aRead,
					write: aWrite,
					unit: aUnit,
					def: aDef,
					desc: aDesc
				},
				native: {},
			});
		} else {
			await this.setObjectNotExistsAsync(aPath, {
				type: 'state',
				common: {
					name: aName,
					type: aType,
					role: aRole,
					read: aRead,
					write: aWrite,
					unit: aUnit,
					min: aMin,
					max: aMax,
					def: aDef,
					desc: aDesc
				},
				native: {},
			});
		}
	}

	isNightTime() {
		const hours = new Date().getHours();
		return (hours >= 22 || hours < 8);
	}

	createRandomString(length) {
		let result = '';
		const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		const charactersLength = characters.length;
		for (let i = 0; i < length; i++) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	}

}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options) => new Boschindego(options);
}
else {
	// otherwise start the instance directly
	(() => new Boschindego())();
}
