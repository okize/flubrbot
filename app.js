"use strict";

const Slack = require('slack-client');
const request = require('request');
const _ = require('lodash');

const TOKEN = process.env.FLUBR_SLACK_TOKEN;
const FLUBR_URL = process.env.FLUBR_URL;
const PASS = new RegExp(process.env.FLUBR_PASS, 'g');
const FAIL = new RegExp(process.env.FLUBR_FAIL, 'g');
const AUTORECONNECT = true;
const AUTOMARK = true;

// returns a valid uri for pass/fail image requests
const getFlubrUrl = function (imageType) {
  return `${FLUBR_URL}/api/images/random/${imageType}`;
};

// enumerate object keys & values
const entries = function* (obj) {
  for (let key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
}

// determines channel name
const getChannelName = function (channel) {
  let channelName = (channel && channel.is_channel) ? '#' : '';
  channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
  return channelName;
}

// determines user name
const getUserName = function (user) {
  if (user && user.name) {
    return `@${user.name}`;
  }
  return  "UNKNOWN_USER";
}

const log = function (msg) {
  return console.log(`→  ${msg}`);
}

// init slack instance
const slack = new Slack(TOKEN, AUTORECONNECT, AUTOMARK);

// connect to Slack
slack.on('open', function () {

  let channels = [];
  let groups = [];

  // get the channels that bot is a member of
  for (let channel of entries(slack.channels)) {
    if (channel[1].is_member) {
      channels.push(`#${channel[1].name}`);
    }
  }

  // get all groups that are open and not archived
  for (let group of entries(slack.groups)) {
    if (group[1].is_open && !group[1].is_archived) {
      groups.push(group[1].name);
    }
  }

  // connection message
  return console.log(`
  ****************************************************************
  *  Connected to Slack. You are @${slack.self.name} of ${slack.team.name}.
  *  You are in: ${(_.union(channels, groups).join(', '))}.
  ****************************************************************
  `);

});

// respond to messages in Slack
slack.on('message', function (message) {

  const channel = slack.getChannelGroupOrDMByID(message.channel);
  const user = slack.getUserByID(message.user);
  const channelName = getChannelName(channel);
  const userName = getUserName(user);
  const type = message.type;
  const timestamp = message.ts;
  const text = message.text;

  log(`Received: ${type} ${channelName} ${userName} ${timestamp} ${text}`);

  // respond to build messages with pass/fail image url
  if (type === 'message' && text && channel) {

    let imageType = null;

    if (text.match(PASS)) {
      imageType = 'pass';
    } else if (text.match(FAIL)) {
      imageType = 'fail';
    }

    if (imageType !== null) {
      return request(getFlubrUrl(imageType), function(error, response, body) {
        if (!error && response.statusCode === 200) {
          log(`${imageType} image sent!`);
          return channel.send(body);
        }
        return console.error("Error: " + error);
      });
    }

  } else {

    // this one should probably be impossible, since we're in slack.on 'message'
    const typeError = (type !== 'message') ? `unexpected type ${type}.` : null;

    // can happen on delete/edit/a few other events
    const textError = (text === null) ? 'text was undefined.' : null;

    // in theory some events could happen with no channel
    const channelError = (channel === null) ? 'channel was undefined.' : null;

    // space delimited string of my errors
    const errors = [typeError, textError, channelError].filter(function(el) {
      return el !== null;
    }).join(' ');

    return log(`@${slack.self.name} could not respond. ${errors}`);

  }

});

// log errors
slack.on('error', function (error) {
  return console.error("Error: " + error);
});

slack.login();
