const crypto = require("crypto");
const http = require("http");
const port = 8080;

const requestHandler = (request, response) => {
	console.log(request.url);
	let body = [];

	const hmac = crypto.createHmac("sha1", "OHHAI");

	request.on("data", (chunk) => {
		body.push(chunk);
	}).on("end", () => {
		body = Buffer.concat(body).toString();

		if(!body || !body.toString()) return;

		hmac.on("readable", () => {
			const data = hmac.read();
			if (data) {
				const hash = data.toString("hex");
				const matches = "sha1=" + hash === request.headers["x-hub-signature"];
				if(matches){
					const json = JSON.parse(body);
					console.log(json);
				}else{
					console.error(`"HMAC didn't match! Calculated sha1=${hash}, was sent ${request.headers["x-hub-signature"]}`);
				}
			}
		});


		hmac.write(body);
		hmac.end();
		response.end("");
	});
};

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
	if (err) {
		return console.log("something bad happened", err);
	}

	console.log(`server is listening on ${port}`);
});

server.on("request", requestHandler);
