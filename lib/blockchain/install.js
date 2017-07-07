const fs = require('fs')
const path = require('path')
const process = require('process')

const makeDir = require('make-dir')
const inquirer = require('inquirer')
const _ = require('lodash/fp')

const options = require('../options')
const coinUtils = require('../coin-utils')

const common = require('./common')
const doVolume = require('./do-volume')

const cryptos = coinUtils.cryptoCurrencies()

const logger = common.logger

const PLUGINS = {
  BTC: require('./bitcoin.js'),
  LTC: require('./litecoin.js'),
  ETH: require('./ethereum.js'),
  DASH: require('./dash.js'),
  ZEC: require('./zcash.js')
}

module.exports = {run}

function installedFilePath (crypto) {
  return path.resolve(options.blockchainDir, crypto.code, '.installed')
}

function isInstalled (crypto) {
  return fs.existsSync(installedFilePath(crypto))
}

function processCryptos (codes) {
  if (_.isEmpty(codes)) {
    logger.info('No cryptos selected. Exiting.')
    process.exit(0)
  }

  logger.info('Thanks! Installing: %s. Will take a while...', _.join(', ', codes))

  const goodVolume = doVolume.prepareVolume()

  if (!goodVolume) {
    logger.error('There was an error preparing the disk volume. Exiting.')
    process.exit(1)
  }

  const selectedCryptos = _.map(code => _.find(['code', code], cryptos), codes)
  _.forEach(setupCrypto, selectedCryptos)
  common.es('pm2 save')
  logger.info('Installation complete.')
}

function setupCrypto (crypto) {
  logger.info(`Installing ${crypto.display}...`)
  const cryptoDir = path.resolve(options.blockchainDir, crypto.code)
  makeDir.sync(cryptoDir)
  const cryptoPlugin = plugin(crypto)
  const oldDir = process.cwd()
  const tmpDir = '/tmp/blockchain-install'

  makeDir.sync(tmpDir)
  process.chdir(tmpDir)
  common.es('rm -rf *')
  common.fetchAndInstall(crypto)
  cryptoPlugin.setup(cryptoDir)
  fs.writeFileSync(installedFilePath(crypto), '')
  process.chdir(oldDir)
}

function plugin (crypto) {
  const plugin = PLUGINS[crypto.cryptoCode]
  if (!plugin) throw new Error(`No such plugin: ${crypto.cryptoCode}`)
  return plugin
}

function run () {
  const choices = _.map(c => {
    const checked = isInstalled(c)
    return {
      name: c.display,
      value: c.code,
      checked,
      disabled: checked && 'Installed'
    }
  }, cryptos)

  const questions = []

  questions.push({
    type: 'checkbox',
    name: 'crypto',
    message: 'Which cryptocurrencies would you like to install?',
    choices
  })

  inquirer.prompt(questions)
  .then(answers => processCryptos(answers.crypto))
}
