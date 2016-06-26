function save_options() {
	var options = {};
	options.host = document.getElementById('host').value;
	options.deviceId = document.getElementById('device_id').value;
	options.authToken= document.getElementById('auth_token').value;

	chrome.storage.local.set(options, function() {
		var status = document.getElementById('status');
		status.textContent = 'Options saved.';
		setTimeout(function() {
			status.textContent = '';
		}, 750);
	});
}

function restore_options() {
	chrome.storage.local.get({
		host: "ws://localhost:5000/stream/sarif",
		deviceId: "webextension",
		authToken: "",
	}, function(options) {
		document.getElementById('host').value = options.host;
		document.getElementById('device_id').value = options.deviceId;
		document.getElementById('auth_token').value = options.authToken;
	});
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
