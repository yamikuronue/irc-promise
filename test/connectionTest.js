'use strict'

    
const chai = require('chai');
const Connection = require('../src/connection');

chai.use(require('chai-as-promised'));
chai.use(require('chai-string'));
chai.use(require('sinon-chai'));
chai.should();

const Sinon = require('sinon');

describe('Connection', () => {
        var opts = {
            server: 'irc.darkmyst.org',
            port: '6697'
        };
    
    let sandbox, con;
    
    
    
    beforeEach(function() {
        sandbox = Sinon.sandbox.create();
        con = new Connection(opts);
        sandbox.stub(con, "emit");
        sandbox.stub(require('tls'), "connect").yields();
    });
    
    afterEach(function() {
        sandbox.restore();
    });
    
    it('exists', () => {
        con.should.be.ok;
    });
    
    it('connects to servers', () => {
        return con.connect().should.resolve;
    });
    
    describe('replyPing', () => {
        it('should reply "PONG"', () => {
            let con = new Connection(opts);
            const fakeTLS = {
                write: Sinon.stub()
            };
            
            con.data.con = fakeTLS;
            
            con.replyPing({});
            return fakeTLS.write.should.have.been.calledWith('PONG');
        });
    });
    
    describe('parseData', () => {
        it('should parse a valid line', () => {
            con.parseData(":prometheus.no.eu.darkmyst.org NOTICE * :*** Looking up your hostname...");
            return con.emit.should.have.been.calledWith('data');
        });
        it('should parse another valid line', () => {
            con.parseData(":flame.de.eu.darkmyst.org NOTICE * :*** Found your hostname");
            return con.emit.should.have.been.calledWith('data');
        });
        
        it('should reject a non-line', () => {
            con.parseData("Pollen Warning!");
            return con.emit.should.not.have.been.called;
        });
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