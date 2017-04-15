'use strict';
 
const debug = require('debug')('sockbot:providers:irc:connection');
const tls = require('tls');
const net = require('net');
const EventEmitter = require('events').EventEmitter;
const os = require('os');

class Connection extends EventEmitter {
    constructor(options) {
        super();
        this.data = {
            server: options.server,
            port: options.port,
            nickname: options.nick
        };
        
        this.buffer = new Buffer('');
    }
    
    connect() {
        let data = this.data;
        let self = this;
        return new Promise(function(resolve, reject) {
           // data.con = tls.connect({
            data.con = net.connect({
                host: data.server,
                port: data.port
            }, () => self._phase2(resolve));
            
            //Start the data processing
            data.con.on('data', (data) => self.handleData(data));
        });
    }
    
    handleData(data) {
        let chunk = data.toString('utf8');
        this.buffer += chunk;
        
        let lines = this.buffer.split('\r\n');
        this.buffer = lines.pop();                  //Anything that doesn't end in a linebreak goes back on the buffer
        lines.map((line) => this.parseData(line));
    }
    
    send(line) {
        debug(`<- ${line}`);
        this.data.con.write(line + '\r\n');
    }
    
    _phase2(resolve) {
        this.send(`NICK ${this.data.nickname}`);
        this.send(`USER ${this.data.nickname} 0 * :Powered by SockDrawer`);
        resolve();
    }
    
    parseData(line) {
        debug(` -> ${line}`);
        const match = /(:[^ ]+ )?([A-Za-z0-9]+) (.+)?/.exec(line);
        if (match) {
            const msg = {
                prefix: match[1], //prefix comes up to the first space
                command: match[2], //then the command
                args: this.parseArgs(match[3]) //everything else is arguments
            };

            this.emit("data", msg);
            
            //parsing
            switch(msg.command.toUpperCase()) {
                case 'NOTICE':
                    this.parseNotice(msg);
                    break;
                case 'PING':
                    this.replyPing(msg);
                    break;
                case '001':
                    this.autoJoin(msg);
            }
        } else {
            debug('Data failed to parse: ' + line);
        }
    }
    
    parseArgs(argString) {
        let ret = [];
        let temp = '';
        let colon = false;
        
        argString.split(' ').map((val, index) => {
            //Any arguments starting at position 15 are treated as one argument
            if (val.startsWith(':')) colon = true;
            
            if (index >= 14 || colon) {
                temp += val + ' ';
            } else {
                ret.push(val);
            }
        });
        
        if (temp) {
            temp = temp.trim();
            ret.push(temp);
        }
        
        return ret;
    }

    autoJoin(data) {
        //Join channels
    }
    
    replyPing(data) {
        this.send(`PONG ${data.args}`); //reply to keep connection alive
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