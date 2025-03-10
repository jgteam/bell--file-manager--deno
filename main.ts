// --- Setup and Dependencies

// https://deno.land/x/oak
import { Application , Router , send } from "https://deno.land/x/oak/mod.ts";

// https://deno.land/x/oak_upload_middleware
import { upload } from "https://deno.land/x/oak_upload_middleware/mod.ts";

// https://deno.land/x/mysql
import { Client } from "https://deno.land/x/mysql/mod.ts";

// https://deno.land/std/hash
import { createHash } from "https://deno.land/std/hash/mod.ts";

// https://github.com/denjucks/session
// https://deno.land/x/session
// import { Session } from "https://deno.land/x/session/mod.ts";

// Sessions (https://github.com/denjucks/session#usage)
// const session = new Session({ framework: "oak" });
// await session.init();

// Config-Variablen laden
import { config } from "./config.ts";

const port = config.port;
const rootURL = config.rootURL;

// --- Mysql
// Neue Verbindung mit dem Datenbankserver aufbauen
const con = await new Client().connect({
    hostname: config.host,
    username: config.user,
    password: config.password,
    db: config.database
});

// --- Functions
// Gibt die URL für den Dateidownload zurück
function getFileDownloadURL(fileid: String): String {
    return rootURL + "download/" + fileid;
}

// Gibt entweder "false" zurück (falls die Fileid nicht in der Datenbank hinterlegt ist) oder den Dateipfad, welcher in der Datenbank hinterlegt ist.
async function getFilePath(fileid: any) {

    // SELECT-QUERY ausführen
    var result = await con.query("SELECT * FROM files_deno WHERE id = ?", [fileid]);

    // Ergebnis überprüfen
    if(!result[0]) {
        return false;
    } else {
        return decodeURI(result[0].fileurl);
    }

}

// Funktion, welche die md5-Checksum einer Datei zurückgibt
// https://stackoverflow.com/a/65334262
async function md5(filepath: any) {

    var fullfilepath = Deno.cwd() + "/" + filepath;

    const hash = createHash("md5");

    const file = await Deno.open(fullfilepath);

    for await (const chunk of Deno.iter(file)) {
        hash.update(chunk);
    }

    var out = hash.toString();

    Deno.close(file.rid);

    return out;

}

// --- Router for "upload" and "download"
const router = new Router();
// upload -> upload('filestorage', {...})-Funktion vom "oak_upload_middleware" kümmert sich um die Dateispeicherung
router.post("/upload", upload('filestorage', { extensions: ['txt', 'json'], maxSizeBytes: 20000000, maxFileSizeBytes: 10000000 }), async function (context: any, next: any) {
    // UPLOAD

    if (!context.uploadedFiles.file) {
        // Falls keine Datei über POST übergeben wurde

        // Error-Antwort erstellen
        context.response.status = 400;
        context.response.body = {
            "status": false,
            "message": "No file uploaded"
        };

    } else {
        // Falls eine Datei über POST übergeben wurde

        var file = context.uploadedFiles.file;

        // Teilt die uploadid (zB: filestorage/2020/12/4/22/23/55/18d1e7fb-cd0b-4efd-aac3-506c0b7c49f2) an den Schrägstrichen,
        // damit man im nächsten Schritt die UUID rausfiltern kann
        var uploadid = file.id.split("/");

        // Generiert eine einzigartige ID (fileid) mit der Hilfe von der schon generierten UUID von dem oak_upload_middleware
        var fileid = Date.now() + "--" + uploadid[uploadid.length - 1];

        // Dateispeicherpfad auf dem Server
        var fileurl = file.url;
        // Dateiname
        var filename = file.filename;

        // fileid, filename und fileurl in die Datenbank aufnehmen
        con.execute('INSERT INTO files_deno (id, filename, fileurl) VALUES (?, ?, ?)', [fileid, filename, fileurl]);

        // Erfolgs-Antwort erstellen
        context.response.status = 200;
        context.response.body = {
            "status": true,
            "download": getFileDownloadURL(fileid),
            "filename": filename,
            // Weitere Eigenschaften
            "filetype": file.type,
            "filesize": file.size,
            "md5": await md5(fileurl)
        };

    }

}).get("/download/:fileid", async function(context) {
    // DOWNLOAD

    // fileid-Parameter in Variable schreiben
    var fileid = context.params.fileid;

    // Prüfen ob Datei/fileid existiert und falls ja, den Pfad der Datenbank entnehmen
    var filepath = await getFilePath(fileid);

    if (filepath === false) {
        // Datei ist nicht in der Datenbank vermerkt

        // Error-Antwort erstellen
        context.response.status = 404;
        context.response.body = {
            "status": false,
            "message": "File not found"
        };

    } else {
        // Datei ist in der Datenbank vermerkt

        // Ganzen absoluten Pfad formen
        var fullFilepath = Deno.cwd() + "/" + filepath;

        // Dateinamen dem Pfad entnehmen
        var filename = fullFilepath.split("/")[fullFilepath.split("/").length - 1];

        // https://stackoverflow.com/a/62709235
        // Datei auslesen
        var fileContent = await Deno.readFile(fullFilepath);

        // Dateidownload-Antwort erstellen
        context.response.status = 200;
        context.response.body = fileContent;
        context.response.headers.set('Content-Type', 'plain/text');
        context.response.headers.set('Content-disposition', 'attachment; filename="' + filename + '"');

    }

}).get("/download", async function (context) {
    // PSEUDO-DOWNLOAD
    // fileid-Parameter fehlt

    // Error-Antwort erstellen
    context.response.status = 400;
    context.response.body = {
        "status": false,
        "message": "Fileid not defined"
    };
}).get("/getUploadHistory", async function (context) {
    // Upload-Verlauf übermitteln

    // context.state.session.set(...);
    // context.state.session.get(...);

    // => Benutzung von Sessions erzeugt einen "500 internal server error"...

    context.response.status = 501;
    context.response.body = {
        "status": false,
        "message": "Not implemented"
    };

}).get("/getDownloadHistory", async function (context) {
    // Download-Verlauf übermitteln

    // context.state.session.set(...);
    // context.state.session.get(...);

    // => Benutzung von Sessions erzeugt einen "500 internal server error"...

    context.response.status = 501;
    context.response.body = {
        "status": false,
        "message": "Not implemented"
    };

}).get("/history", async function (context) {
    // Verlaufsseite (sigle static file)

    // hist.html einlesen
    var fileContent = await Deno.readFile(Deno.cwd() + "/hist.html");

    // hist.html übermitteln
    context.response.status = 200;
    context.response.body = fileContent;
    context.response.headers.set('Content-Type', 'text/html');
});

// --- Middlewares

// Webapp erstellen
const app = new Application();

//app.use(session.use()(session));

// Router aktivieren
app.use(router.routes());
app.use(router.allowedMethods());

// --- Static files
// Hier ist nur der Ordner "static"
// Die hist.html wird noch oben bei den Routen übermittelt
app.use(async function(context) {
    await send(context, context.request.url.pathname, {
        // Sendet beim aufrufen der rootURL die Dateien (form.html) aus dem static Ordner, falls kein andere Route greift
        root: Deno.cwd() + "/static",
        index: "form.html",
    });
});

// --- Start listening
await app.listen({ port: port });
