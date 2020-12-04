// --- Setup and Dependencies

// https://deno.land/x/oak
import { Application , Router , send } from "https://deno.land/x/oak/mod.ts";

// https://deno.land/x/oak_upload_middleware
import { upload } from "https://deno.land/x/oak_upload_middleware/mod.ts";

// https://deno.land/x/mysql
import { Client } from "https://deno.land/x/mysql/mod.ts";

import { config } from "./config.ts";

const port = config.port;
const rootURL = config.rootURL;

// --- Mysql
const con = await new Client().connect({
    hostname: config.host,
    username: config.user,
    password: config.password,
    db: config.database
});







// --- Functions
function getFileDownloadURL(fileid: String) {
    return rootURL + "download/" + fileid;
}

async function getFilePath(fileid: any) {

    var result = await con.query("SELECT * FROM files_deno WHERE id = '" + poorMysqlStringEscape(fileid) + "'");

    if(!result[0]) {
        return false;
    } else {
        return decodeURI(result[0].fileurl);
    }

}

function poorMysqlStringEscape(string: String) {
    return string.replace("'", "");
}







// --- Router for "upload" and "download"
const router = new Router();
router.post("/upload", upload('filestorage', { extensions: ['txt', 'json'], maxSizeBytes: 20000000, maxFileSizeBytes: 10000000 }), async function (context: any, next: any) {

    if (!context.uploadedFiles.file) {

        context.response.status = 400;
        context.response.body = {
            "status": false,
            "message": "No file uploaded"
        };

    } else {

        var uploadid = context.uploadedFiles.file.id.split("/");
        var fileid = Date.now() + "--" + uploadid[uploadid.length - 1];
        var fileurl = context.uploadedFiles.file.url;
        var filename = context.uploadedFiles.file.filename;

        con.execute(`INSERT INTO files_deno (id, filename, fileurl) VALUES ('` + poorMysqlStringEscape(fileid) + `', '` + poorMysqlStringEscape(filename) + `', '` + poorMysqlStringEscape(fileurl) + `')`);

        context.response.status = 200;
        context.response.body = {
            "status": true,
            "filename": filename,
            "download": getFileDownloadURL(fileid)
        };
    }

}).get("/download/:fileid", async function(context) {

    var fileid = context.params.fileid;

    var filepath = await getFilePath(fileid);

    if (filepath === false) {

        context.response.status = 404;
        context.response.body = {
            "status": false,
            "message": "File not found"
        };

    } else {

        var fullFilepath = Deno.cwd() + "/" + filepath;
        var filename = fullFilepath.split("/")[fullFilepath.split("/").length - 1];

        //context.response.body = (filepath);
        //return;

        // https://stackoverflow.com/a/62709235
        var fileContent = await Deno.readFile(fullFilepath);


        context.response.status = 200;
        context.response.body = fileContent;
        context.response.headers.set('Content-Type', 'plain/text');
        context.response.headers.set('Content-disposition', 'attachment; filename="' + filename + '"');

    }

}).get("/download", async function (context) {
    context.response.status = 400;
    context.response.body = {
        "status": false,
        "message": "Fileid not defined"
    };
});


// --- Middlewares

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());


// --- Static files
app.use(async function(context) {
    await send(context, context.request.url.pathname, {
        root: Deno.cwd() + "/static",
        index: "form.html",
    });
});




// --- Start listening
await app.listen({ port: port });




























