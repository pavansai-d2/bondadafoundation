import app from "./app.js";
import env from "./config/env.js";

const PORT = env.port;


// ============================================================
// START SERVER
// ============================================================

const server = app.listen(PORT, () => {

    console.log(
        `Bondada Foundation API running on port ${PORT}`
    );

    console.log(
        `Environment: ${env.nodeEnv}`
    );

    console.log(
        `Health check: http://localhost:${PORT}/health`
    );


    // Never print database passwords or other secrets.
    console.log(
        "DB host configured:",
        Boolean(env.db.host)
    );

    console.log(
        "DB name configured:",
        Boolean(env.db.name)
    );
});


// ============================================================
// SERVER ERROR
// ============================================================

server.on("error", (error) => {

    console.error(
        "Server failed to start:",
        error
    );
});


// ============================================================
// GO DADDY / REVERSE PROXY KEEP-ALIVE
// ============================================================
//
// Scholarship submissions contain multiple files and can take
// longer than a normal JSON request.
//
// Keep Node's socket alive longer than the reverse proxy's
// expected idle period.
//

server.keepAliveTimeout = 65000;

server.headersTimeout = 66000;


// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

const shutdown = (signal) => {

    console.log(
        `${signal} received. Shutting down server...`
    );


    server.close(() => {

        console.log(
            "HTTP server closed."
        );

        process.exit(0);
    });


    // Safety timeout.
    setTimeout(() => {

        console.error(
            "Forced shutdown after timeout."
        );

        process.exit(1);

    }, 10000).unref();
};


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);