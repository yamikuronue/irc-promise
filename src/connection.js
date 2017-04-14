'use strict';
 
const debug = require('debug')('sockbot:providers:irc:connection');
const tls = require('tls');
const EventEmitter = require('events').EventEmitter;

class Connection extends EventEmitter {
    constructor(options) {
        super();
        this.data = {
            server: options.server,
            port: options.port
        };
    }
    
    connect() {
        let data = this.data;
        let self = this;
        return new Promise(function(resolve, reject) {
            data.con = tls.connect({
                host: data.server,
                port: data.port
            }, function(response) {
                debug(response);
                resolve();
            });

            /*istanbul ignore next*/
            data.con.addListener('data', function(data) {
                const line = data.toString('utf8');
                self.parseData(line);
            });
        });
    }
    
    parseData(line) {
        const match = /:([^ ]+) ([A-Za-z]+) (.+)?/.exec(line);
        debug(line)
        if (match) {
            const msg = {
                prefix: match[1], //prefix comes up to the first space
                command: match[2], //then the command
                args: match[3] //everything else is arguments
            }

            this.emit("data", msg);
            
            //parsing
            switch(msg.command.toUpperCase()) {
                case 'NOTICE':
                    this.parseNotice(msg);
                    break;
            }
        } else {
            debug('Data failed to parse: ' + line);
        }
    }
    
    replyPing(data) {
        this.data.con.write("PONG"); //reply to keep connection alive
        this.emit("ping", data); //in case anyone cares;
    }
    
    parseNotice(data) {
        const match = /([^ ]+) (.+)/.exec(data.args);
        if (match) {
            const notice = {
                nickname: match[1],
                text: match[2]
            };
            this.emit("NOTICE", notice);
        } else {
            debug('Notice failed to parse: ' + data.args);
        }
    }
}

module.exports = Connection;