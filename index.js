#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");
const port = 80;

const seen = [];

if(process.argv.length !== 3 && process.argv.length !== 4){
	console.log(`
github-auto-pull [fileToRun] <secret>

Creates a github webhook server running on port 80.
`);
	process.exit();
}

const fileToRun = process.argv[2];
const secret = process.argv[3];
if(secret){
	console.log("running", fileToRun, "when a correct push with the secret", secret);
}else{
	console.log("running", fileToRun, "when a push is sent. You should configure a secret in your webhooks because this prevents somebody from DoSing you by continually sending fake pushes.");
}

const logfile = path.join(path.dirname(fileToRun), "out.log");
console.log("Program output will be logged to " + logfile);

const out = fs.openSync(logfile, "a");
const err = fs.openSync(logfile, "a");

const procBody = (body, request) => {
	const guid = request.headers["x-github-delivery"];
	if(seen.includes(guid)) return console.error("Ignored duplicate GUID", guid);
	seen.push(guid);

	const json = JSON.parse(body);
	if(json.zen){
		console.log(`Got ping from ${json.repository.html_url} (sender: ${json.sender.login})`);
	}else if(json.pusher){
		console.log(`Got commits from ${json.pusher.name}! ${json.commits.reduce((str, commit) => str + `\n${commit.id} ${commit.author.name}: ${commit.message}`, "")}`);

		const procError = err => {
			if(err.code === "EACCES"){
				console.error(`It looks like you've forgot to give yourself execute permissions on your script.
Run
chmod +x ${fileToRun}`);
			}else{
				console.error("Could not spawn", fileToRun, "got error", err);
			}
		};

		try{
			const subprocess = spawn(fileToRun, [], {
				detached: true,
				stdio: ["ignore", out, err]
			});

			subprocess.on("close", (code) => {
				if (code !== 0) {
					console.log(`Script exited with code ${code}`);
				}
			});

			subprocess.on("error", procError);

			subprocess.unref();
		}catch (e){
			procError(e);
		}
	}
};

const requestHandler = (request, response) => {
	let body = [];
	let hmac;

	if(secret) hmac = crypto.createHmac("sha1", secret);

	request.on("data", (chunk) => {
		body.push(chunk);
	}).on("end", () => {
		body = Buffer.concat(body).toString();

		if(!body || !body.toString()) response.end("No message was sent.");

		if(secret){
			hmac.on("readable", () => {
				const data = hmac.read();
				if (data) {
					const hash = data.toString("hex");
					const matches = "sha1=" + hash === request.headers["x-hub-signature"];
					if(matches){
						procBody(body, request);
					}else{
						console.error(`HMAC didn't match! Calculated sha1=${hash}, was sent ${request.headers["x-hub-signature"]}`);
					}
				}
			});
			hmac.write(body);
			hmac.end();
		}else{
			procBody(body, request);
		}
		response.end("hi");
	});
};

const server = http.createServer(requestHandler);

server.listen(port, "0.0.0.0", (err) => {
	if (err) {
		return console.log("something bad happened", err);
	}

	console.log(`server is listening on ${port}`);
});

server.on("request", requestHandler);
