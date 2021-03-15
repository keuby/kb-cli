#!/usr/bin/env node

const { program } = require('commander')
const actions = require('../lib')

for (const [action, config] of Object.entries(actions)) {
    const command = program.command(action);
    command.usage(config.usage);
    config.options.forEach(option => command.option(...option));
    command.action(config.action);
}

program.parse(process.argv)