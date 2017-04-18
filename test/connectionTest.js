'use strict'

    
const chai = require('chai');
const Connection = require('../src/connection');

chai.use(require('chai-as-promised'));
chai.use(require('chai-string'));
chai.use(require('sinon-chai'));
chai.should();

const Sinon = require('sinon');
const fakeTLS = {
    addListener: Sinon.stub(),
    write: Sinon.stub()
};

describe('Connection', () => {
        var opts = {
            server: 'irc.darkmyst.org',
            port: '6697',
            nick: 'aNickName'
        };
    
    let sandbox, con;

    beforeEach(function() {
        sandbox = Sinon.sandbox.create();
        con = new Connection(opts);
        sandbox.stub(con, "emit");
        sandbox.stub(require('tls'), "connect").yields();
        con.data.con = fakeTLS;
    });
    
    afterEach(function() {
        sandbox.restore();
        fakeTLS.write.reset();
        fakeTLS.addListener.reset();
    });
    
    it('exists', () => {
        con.should.be.ok;
    });
    
    describe('connect', () => {
        
        beforeEach(function() {
            sandbox.stub(require('net'), 'connect').yields();
        });
    
        it('connects to servers', () => {
            return con.connect().should.resolve;
        });
        
        it('calls phase2', () => {
            sandbox.spy(con, '_phase2');
            return con.connect().then(() => {
               con._phase2.should.have.been.called; 
            });
        });
        
    });
    
    describe('phase2', () => {

        it('sends a NICK', () => {
            const fakeResolve = Sinon.stub();
            con._phase2(fakeResolve);
            fakeTLS.write.should.have.been.calledWith('NICK aNickName\r\n');
            fakeResolve.should.have.been.called;
        });
        
        it('sends a USER', () => {
            const fakeResolve = Sinon.stub();
            con._phase2(fakeResolve);
            fakeTLS.write.should.have.been.calledWith(Sinon.match('USER'));
            fakeResolve.should.have.been.called;
        });
    });
    
    describe('replyPing', () => {
        it('should reply "PONG"', () => {
            con.replyPing({args: '12345'});
            return fakeTLS.write.should.have.been.calledWith('PONG 12345\r\n');
        });
    });
    
    describe('handleData', () => {
        beforeEach(function() {
            sandbox.stub(con, 'parseData');
        });
        
        it('should parse a line', () => {
            con.handleData(new Buffer('This is a line\r\n'));
            return con.parseData.should.have.been.calledWith('This is a line');
        });

        it('shouldn\'t barf on nulls', () => {
            con.handleData(null);
            return con.should.be.ok;
        });
        
        it('should parse two lines', () => {
            con.handleData(new Buffer('This is a line\r\nThis is another line\r\n'));
            con.parseData.should.have.been.calledWith('This is a line');
            con.parseData.should.have.been.calledWith('This is another line');
        });
        
        it('should parse a line split into two chunks', () => {
            con.handleData(new Buffer('This is a line'));
            con.handleData(new Buffer(' that is extra long\r\n'));
            con.parseData.should.have.been.calledWith('This is a line that is extra long');
        });
        
        it('should parse a linebreak across chunks', () => {
            con.handleData(new Buffer('This is a line with half a linebreak\r'));
            con.handleData(new Buffer('\n'));
            con.parseData.should.have.been.calledWith('This is a line with half a linebreak');
        });

        it('should parse a character across chunks', () => {
            con.handleData(new Buffer([0xC2]));
            con.handleData(new Buffer([0xA2]));
            con.handleData(Buffer.from('\r\n'));
            con.parseData.should.have.been.calledWith('¢');
        });
    });
    
    describe('parseData', () => {
        beforeEach(function() {
            sandbox.stub(con, 'parseNotice');
            sandbox.stub(con, 'replyPing');
            sandbox.stub(con, 'autoJoin');
        });
        
        it('should parse a valid line', () => {
            con.parseData(":prometheus.no.eu.darkmyst.org NOTICE * :*** Looking up your hostname...");
            return con.emit.should.have.been.calledWith('data');
        });

        it('should parse two lines', () => {
            con.parseData(":prometheus.no.eu.darkmyst.org NOTICE * :*** Looking up your hostname...");
            con.parseData(":flame.de.eu.darkmyst.org NOTICE * :*** Found your hostname");
            return con.emit.should.have.been.calledTwice;
        });
        
        it('should parse a NOTICE from the server', () => {
            con.parseData(":prometheus.no.eu.darkmyst.org NOTICE * :*** Looking up your hostname...");
            return con.parseNotice.should.have.been.called;
        });
        
        it('should parse a PING', () => {
            con.parseData("PING :FFFFFFFFC76EDFCA");
            return con.replyPing.should.have.been.called;
        });

        it('should join when Welcome is sent', () => {
            con.parseData(":flame.de.eu.darkmyst.org 001 yamibot :Welcome to the DarkMyst Internet Relay Chat Network yamibot +109ms");
            return con.autoJoin.should.have.been.called;
        });
    });
    
    describe('parseArgs', () => {
        it('should separate on spaces', () => con.parseArgs('some args').should.deep.equal(['some', 'args']));
        it('should stop at 15', () => con.parseArgs('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18')
            .should.deep.equal(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15 16 17 18']));
        it('should treat : special', () => con.parseArgs('one two :colon and then some words').should.deep.equal(['one', 'two', ':colon and then some words']));
    });

    describe('parseNotice', () => {
        it('should parse a valid notice', () => {
            con.parseNotice({"prefix":"maple.on.ca.darkmyst.org","command":"NOTICE","args":"* :*** Looking up your hostname..."});
            return con.emit.should.have.been.calledWith('NOTICE');
        });
        
        it('should reject a non-notice', () => {
            con.parseNotice({"prefix":"maple.on.ca.darkmyst.org","command":"NOTICE","args":"aaaaaaaaaaaaaaaa"});
            return con.emit.should.not.have.been.calledWith('NOTICE');
        });
    });
});