'use strict';

const Slack = require('slack-client');
const request = require('request');
const _ = require('lodash');

const TOKEN = process.env.FLUBR_SLACK_TOKEN;
const FLUBR_URL = process.env.FLUBR_URL;
const PASS = new RegExp(process.env.FLUBR_PASS, 'g');
const FAIL = new RegExp(process.env.FLUBR_FAIL, 'g');
const AUTORECONNECT = true;
const AUTOMARK = true;

// enumerate object keys & values
const entries = function* (obj) {
  for (let key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
};

// returns a valid uri for pass/fail image requests
const getFlubrUrl = function (flubrType) {
  return `${FLUBR_URL}/api/images/random/${flubrType}`;
};

// returns image type (pass/fail) or null
const getFlubrType = function (text) {
  if (text.match(PASS)) {
    return 'pass';
  } else if (text.match(FAIL)) {
    return 'fail';
  } else {
    return null;
  }
};

// returns a regex
const getFlubrbotRegex = function (self) {
  return new RegExp(`<@${self.id}> ping`, 'g');
};

// determines channel name
const getChannelName = function (channel) {
  let channelName = (channel && channel.is_channel) ? '#' : '';
  channelName = channelName + (channel ? channel.name : 'UNKNOWN_CHANNEL');
  return channelName;
};

// determines username
const getUserName = function (user) {
  if (user && user.name) {
    return `@${user.name}`;
  }
  return 'UNKNOWN_USER';
};

// determines user's first name
const getFirstName = function (user) {
  if (user) {
    if (user.profile.first_name) {
      return user.profile.first_name;
    }
    return user.name;
  }
  return '';
};

// sends a pass/fail image url
const sendFlubrImage = function (channel, imageType) {
  return request(getFlubrUrl(imageType), function (error, response, body) {
    if (!error && response.statusCode === 200) {
      log(`${imageType} image sent!`);
      return channel.send(body);
    }
    return console.error("Error: " + error);
  });
};

// wrapper for console.log
const log = function (msg) {
  return console.log(`→  ${msg}`);
};

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

  if (text) {
    log(`Received: ${type} ${channelName} ${userName} ${timestamp} ${text}`);
  }

  if (type === 'message' && text && channel) {

    // respond to build messages with pass/fail image url
    let imageType = getFlubrType(text);
    if (imageType !== null) {
      return sendFlubrImage(channel, imageType);
    }

    // respond to ping
    if (text.match(getFlubrbotRegex(slack.self))) {
      channel.send(`PONG ${getFirstName(user)}`)
    }

  } else {

    // this one should probably be impossible, since we're in slack.on 'message'
    const typeError = (type !== 'message') ? `unexpected type ${type}.` : null;

    // can happen on delete/edit/a few other events
    const textError = (!text) ? 'text was undefined.' : null;

    // in theory some events could happen with no channel
    const channelError = (!channel) ? 'channel was undefined.' : null;

    // space delimited string of my errors
    const errors = [typeError, textError, channelError].filter(function (el) {
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
