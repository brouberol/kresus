import * as americano from 'cozydb';
import { makeLogger, promisify, promisifyModel } from '../helpers';

let log = makeLogger('models/alert');

let Alert = americano.getModel('bankalert', {
    // external (backend) account id
    bankAccount: String,

    // possible options are: report, balance, transaction
    type: String,

    // only for reports : daily, weekly, monthly
    frequency: String,
    // only for balance/transaction
    limit: Number,
    // only for balance/transaction: gt, lt
    order: String
});

Alert = promisifyModel(Alert);

let request = promisify(::Alert.request);
let requestDestroy = promisify(::Alert.requestDestroy);

Alert.byAccount = async function byAccount(account) {
    if (typeof account !== 'object' || typeof account.id !== 'string')
        log.warn('Alert.byAccount misuse: account must be an Alert instance');

    let params = {
        key: account.id
    };
    return await request('allByBankAccount', params);
};

Alert.byAccountAndType = async function byAccountAndType(accountID, type) {
    if (typeof accountID !== 'string')
        log.warn('Alert.byAccountAndType misuse: accountID must be a string');
    if (typeof type !== 'string')
        log.warn('Alert.byAccountAndType misuse: type must be a string');

    let params = {
        key: [accountID, type]
    };
    return await request('allByBankAccountAndType', params);
};

Alert.reportsByFrequency = async function reportsByFrequency(frequency) {
    if (typeof frequency !== 'string')
        log.warn('Alert.reportsByFrequency misuse: frequency must be a string');

    let params = {
        key: ['report', frequency]
    };
    return await request('allReportsByFrequency', params);
};

Alert.destroyByAccount = async function destroyByAccount(id) {
    if (typeof id !== 'string')
        log.warn("Alert.destroyByAccount API misuse: id isn't a string");

    let params = {
        key: id,
        // Why the limit? See https://github.com/cozy/cozy-db/issues/41
        limit: 9999999
    };
    return await requestDestroy('allByBankAccount', params);
};

// Sync function
Alert.prototype.testTransaction = function(operation) {
    if (this.type !== 'transaction')
        return false;

    let alertLimit = +this.limit;
    let amount = Math.abs(operation.amount);
    return (this.order === 'lt' && amount <= alertLimit) ||
           (this.order === 'gt' && amount >= alertLimit);
};

// Sync function
Alert.prototype.testBalance = function(balance) {
    if (this.type !== 'balance')
        return false;

    let alertLimit = +this.limit;
    return (this.order === 'lt' && balance <= alertLimit) ||
           (this.order === 'gt' && balance >= alertLimit);
};

Alert.prototype.formatOperationMessage = function(operation) {
    // TODO add i18n
    let cmp = this.order === 'lt' ? 'inférieur' : 'supérieur';
    let amount = operation.amount;
    let account = operation.bankAccount;
    let title = operation.title;
    return `Alerte : transaction "${title}" (compte ${account}) d'un montant` +
           `de ${amount}€, ${cmp} à ${this.limit}€.`;
};

Alert.prototype.formatAccountMessage = function(title, balance) {
    // TODO add i18n
    let cmp = this.order === 'lt' ? 'sous le' : 'au dessus du';
    return `Alerte : la balance sur le compte ${title} est ${cmp} seuil ` +
           `d'alerte de ${this.limit}€, avec une balance de ${balance}€.`;
};

module.exports = Alert;
