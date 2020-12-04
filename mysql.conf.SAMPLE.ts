/*
--
-- Tabellenstruktur für Tabelle `files_deno`
--
CREATE TABLE `files_deno` ( `id` VARCHAR(64) NOT NULL , `filename` VARCHAR(512) NOT NULL , `fileurl` VARCHAR(512) NOT NULL , `uploadtimestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP , PRIMARY KEY (`id`)) ENGINE = InnoDB;
*/

const Mysqlconfig = {
    host: "localhost",
    user: "user",
    password: "password",
    database: "dbname"
};

export {Mysqlconfig}