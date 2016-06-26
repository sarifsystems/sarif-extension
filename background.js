var sessionStart;
var sarif;
var interval = 5;

var currHost;
var currData;
var dataQueue = [];

function updateTab() {
	var p = new Promise(function(resolve, reject) {
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			if (tabs[0] && tabs[0].status == "complete") {
				var tab = tabs[0];

				if (currHost) {
					var diff = (new Date()).getTime() - currHost.time
					diff = Math.floor(diff / 1000);
					if (diff >= 2) {
						currData.time_spent[currHost.name] = (currData.time_spent[currHost.name] || 0) + diff
						currData.visited_urls[currHost.url] = currHost.title;
						currHost = undefined;
					}
				}

				var host = tab.url.match(/:\/\/([^\/?#]+)/);
				if (host) {
					if (!currHost || currHost.url != tab.url) {
						currHost = {
							name: host[1],
							title: tab.title,
							url: tab.url,
							time: (new Date()).getTime(),
						}
					}
				} else {
					currHost = undefined;
				}
				resolve();
			}
		});
	});
	return p
}

function submitData() {
	for (var i = 0; i < dataQueue.length; i++) {
		var data = dataQueue[i];
		var max = 0;
		for (var domain in data.time_spent) {
			if (data.time_spent[domain] > max) {
				data.top_domain = domain;
				max = data.time_spent[domain];
			}
		}

		sarif.publish({
			action: "browser/session/update/" + data.end,
			p: data,
		});
	}
	dataQueue = [];
}

function updateData() {
	updateTab().then(function() {
		if (currData) {
			currData.end = (new Date()).toISOString()
			dataQueue.push(currData);

			if (sarif && sarif.isConnected()) {
				submitData();
			}
		}

		currData = {
			session: sessionStart,
			start: (new Date()).toISOString(),
			end: null,
			interval: interval,
			time_spent: {},
			visited_urls: {},
		};
	})
}

function enable() {
	chrome.storage.local.get({
		host: "",
		deviceId: "webextension",
		authToken: "",
	}, function(options) {
		if (!options.host) {
			return
		}

		var tries = 0;
		sarif = new SarifClient(options.host, options.deviceId, options.authToken);
		sarif.onOpen = function() {
			tries = 0;
			submitData();
		}
		sarif.onClose = function() {
			tries++;

			var nextTry = (tries < 3 ? 30*1000: 5*60*1000);
			window.setTimeout(function() {
				sarif.connect()
			}, nextTry)
		}

		updateData();
		chrome.tabs.onUpdated.addListener(updateTab);
		chrome.tabs.onActivated.addListener(updateTab);

		var time = new Date();
		sessionStart = time.toISOString();
		time.setSeconds(0);
		time.setMinutes(Math.floor(time.getMinutes() / interval + 1) * interval);
		chrome.alarms.create("sync", {
			when: time.getTime(),
			periodInMinutes: interval,
		});
		chrome.alarms.onAlarm.addListener(updateData);
	})
}

function disable() {
	if (!sarif) {
		return;
	}
	sarif.close()
	sarif = undefined;

	chrome.tabs.onUpdated.removeListener(updateTab);
	chrome.tabs.onActivated.removeListener(updateTab);
	chrome.alarms.clear("sync");
	chrome.alarms.onAlarm.removeListener(updateData);
}

enable();
chrome.storage.onChanged.addListener(function() {
	disable();
	enable();
});
