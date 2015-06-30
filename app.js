"use strict";

const Slack = require('slack-client');
const request = require('request');
const _ = require('lodash');

const TOKEN = process.env.FLUBR_SLACK_TOKEN;
const IMAGES_URL = process.env.FLUBR_URL;
const PASS = new RegExp(process.env.FLUBR_PASS, 'g');
const FAIL = new RegExp(process.env.FLUBR_FAIL, 'g');
const AUTORECONNECT = true;
const AUTOMARK = true;

// returns a valid uri for pass/fail image requests
const getFlubrUri = function (type) {
  return `${IMAGES_URL}/api/images/random/${type}`;
};

// enumerate object keys & values
const entries = function* (obj) {
  for (let key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
}

// init slack instance
const slack = new Slack(TOKEN, AUTORECONNECT, AUTOMARK);

// connect to Slack
slack.on('open', function () {

  let channels = [];
  let groups = [];

  // get channels bot is in
  for (let channel of entries(slack.channels)) {
    if (channel[1].is_member) {
      channels.push(`#${channel[1].name}`);
    }
  }

  // get groups bot is in
  for (let group of entries(slack.groups)) {
    if (group[1].is_open && !group[1].is_archived) {
      groups.push(group[1].name);
    }
  }

  // connection message
  return console.log(`
  Connected to Slack. You are @${slack.self.name} of ${slack.team.name}.
  You are in: ${(_.union(channels, groups).join(', '))}.
  `);

});

// log errors
slack.on('error', function (error) {
  return console.error("Error: " + error);
});

slack.login();
