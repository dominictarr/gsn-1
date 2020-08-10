import {
  entriesToObj,
  filterMembers,
  filterType,
  parseServerConfig,
  resolveServerConfig
} from '../../src/relayserver/ServerConfigParams'
import * as fs from 'fs'
import { expectRevert } from '@openzeppelin/test-helpers'
import {
  VersionOracleInstance
} from '../../types/truffle-contracts'
import { string32 } from '../../src/common/VersionOracle'

require('source-map-support').install({ errorFormatterForce: true })
const VersionOracleContract = artifacts.require('VersionOracle')

function expectThrow (func: () => void, match: string): void {
  try {
    func()
  } catch (e) {
    assert.include(e.toString(), match)
    return
  }
  assert.fail('expected to fail with: ' + match)
}

function addr (n: number): string {
  return '0x'.padEnd(42, n.toString())
}

context('#ServerConfigParams', () => {
  context('utils', () => {
    it('#filterType', () => {
      assert.deepEqual(
        filterType({ a: 'number', b: 'string', c: 'number' }, 'number'),
        ['a', 'c'])
    })
    it('#entriesToObj', () => {
      const a = { x: 1, y: 2, z: { a: 11, b: 22 } }
      assert.deepEqual(a, entriesToObj(Object.entries(a)))
    })

    it('#filterMembers', () => {
      const a = { x: 1, y: 2, z: 3 }
      const config = { x: 'number', y: 'string' }

      assert.deepEqual(filterMembers(a, config), { x: 1, y: 2 })
    })
  })

  context('#parseServerConfig', () => {
    const tmpConfigfile = '/tmp/test.configfile.tmp'
    after(() => {
      if (fs.existsSync(tmpConfigfile)) {
        fs.unlinkSync(tmpConfigfile)
      }
    })
    it('should parse command line params', function () {
      assert.deepEqual(
        parseServerConfig(['--devMode=true', '--relayHubAddress=123'], {}),
        { devMode: true, relayHubAddress: '123' })
    })
    it('should use env as defaults', function () {
      assert.deepEqual(
        parseServerConfig(['--devMode=true', '--relayHubAddress=123'], {
          relayHubAddress: 'hubFromEnv',
          url: 'urlFromEnv'
        }),
        { devMode: true, relayHubAddress: '123', url: 'urlFromEnv' })
    })
    it('should throw on unknown cmdline param', function () {
      expectThrow(() => parseServerConfig(['--asdasd'], {}), 'unexpected param asdasd')
    })
    it('should throw on invalid type of cmdline param', function () {
      expectThrow(() => parseServerConfig(['--debug=asd'], {}), 'Invalid boolean: debug')
    })
    it('should throw on missing config file', function () {
      expectThrow(() => parseServerConfig(['--config=nosuchfile'], {}), 'unable to read config file')
    })
    it('should abort on invalid config file', function () {
      fs.writeFileSync(tmpConfigfile, 'asdasd')
      expectThrow(() => parseServerConfig(['--config', tmpConfigfile], {}), 'SyntaxError')
    })
    it('should abort on unknown param in config file', function () {
      fs.writeFileSync(tmpConfigfile, '{"asd":123}')
      expectThrow(() => parseServerConfig(['--config', tmpConfigfile], {}), 'unexpected param asd')
    })
    it('should read param from file if no commandline or env', function () {
      fs.writeFileSync(tmpConfigfile, '{"pctRelayFee":123, "baseRelayFee":234, "port":345}')
      assert.deepEqual(
        parseServerConfig(['--config', tmpConfigfile, '--port', '111'], { baseRelayFee: 222 }),
        { baseRelayFee: 222, config: tmpConfigfile, pctRelayFee: 123, port: 111 })
    })
  })
  context('#resolveServerConfig', () => {
    const provider = web3.currentProvider
    it('should fail on missing hub/oracle', async () => {
      await expectRevert(resolveServerConfig({}, provider), 'must have either relayHubAddress or versionOracleAddress')
    })

    it('should fail on invalid relayhub address', async () => {
      const config = { relayHubAddress: '123' }
      await expectRevert(resolveServerConfig(config, provider), 'invalid address: 123')
    })
    it('should fail on no-contract relayhub address', async () => {
      const config = { relayHubAddress: addr(1) }
      await expectRevert(resolveServerConfig(config, provider), 'RelayHub: no contract at address 0x1111111111111111111111111111111111111111')
    })
    it('should fail on missing hubid for versionoracle', async () => {
      const config = { versionOracleAddress: addr(1) }
      await expectRevert(resolveServerConfig(config, provider), 'missing relayHubId to read from versionOracle')
    })
    it('should fail on no-contract versionOracle address', async () => {
      const config = { versionOracleAddress: addr(1), relayHubId: 'hubid' }
      await expectRevert(resolveServerConfig(config, provider), 'VersionOracle: no contract at address 0x1111111111111111111111111111111111111111')
    })
    contract('with versionOracle', () => {
      let oracle: VersionOracleInstance

      before(async () => {
        oracle = await VersionOracleContract.new()
        await oracle.addVersion(string32('hub-invalidaddr'), string32('1.0'), 'notaddress')
        await oracle.addVersion(string32('hub-nocontract'), string32('1.0'), addr(2))
        await oracle.addVersion(string32('hub-wrongcontract'), string32('1.0'), oracle.address)
      })

      it('should fail on invalid hub address in oracle', async () => {
        const config = { versionOracleAddress: oracle.address, relayHubId: 'hub-invalidaddr' }
        await expectRevert(resolveServerConfig(config, provider), 'VersionOracle: no contract at address 0x1111111111111111111111111111111111111111')
      })
      it('should fail on no contract at hub address in oracle', async () => {
        const config = { versionOracleAddress: oracle.address, relayHubId: 'hub-nocontract' }
        await expectRevert(resolveServerConfig(config, provider), 'VersionOracle: no contract at address 0x1111111111111111111111111111111111111111')
      })
      it('should fail on wrong contract (not relayhub) at hub address in oracle', async () => {
        const config = { versionOracleAddress: oracle.address, relayHubId: 'hub-wrongcontract' }
        await expectRevert(resolveServerConfig(config, provider), 'VersionOracle: no contract at address 0x1111111111111111111111111111111111111111')
      })
    })
  })
})
