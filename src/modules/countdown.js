/**
 * @name christmascountdownbot
 * @author eartharoid <contact@eartharoid.me>
 * @copyright 2020 Isaac Saunders (eartharoid)
 * @license MIT
 */

const spacetime = require('spacetime');
const utils = require('./utils');
const Christmas = require('./christmas');
const { Embed } = require('../bot');

const I18n = require('../locales');

module.exports = {
	disable: async guild => {
		return await guild.client.db.Guild.update({
			channel: null,
			enabled: false // disable
		}, {
			where: {
				id: guild.id
			}
		});
	},
	auto: async (guild, timezone) => {	
		let now = spacetime.now(timezone); // now in the timezone
		if (now.month() === 11 && now.date() === 1) { // 1st Dec (months are 0-11)
			await guild.client.db.Guild.update({
				enabled: true // enable
			}, {
				where: {
					id: guild.id
				}
			});
		} else if (now.month() === 11 && now.date() === 26) { // 26th Dec
			await guild.client.db.Guild.update({
				enabled: false // disable
			}, {
				where: {
					id: guild.id
				}
			});
		}	
	},
	run: async (client) => {
		client.log.info('Running countdown task');
		let number = 0;
		client.guilds.cache.forEach(async guild => {
			if (!guild.available) return client.log.warn(`Guild ${guild.id} not available`);
			let settings = await guild.settings(),
				tz = settings.timezone || 'UTC';

			if (settings.auto) {
				await this.auto(guild);
				settings = await guild.settings(); // previous line may update settings
			}

			if (!settings.enabled) return; // stop here if the guild isn't enabled

			// check the time
			let now = spacetime.now(tz);
			if (now.hour() !== 0) { // 00:00 - 00:59 in the guild timezone
				if (settings.last) {
					let last = spacetime(settings.last, tz),
						diff = last.diff(now, 'hours');
					if (diff < 24) return; // return if last was less than 24h ago
				} else return; // return if no last
			}
		
			// either it is 00:00 - 00:59, or the last was sent over 24 hours ago
			// (meaning it's probably the morning and the bot was offline when it was meant to send)
			
			// let channel = await guild.channels.cache.get(settings.channel);
			let channel = await client.channels.fetch(settings.channel);
			
			if (!channel) {
				this.disable(guild, tz);
				return client.log.console(`Disabled guild ${guild.id} - missing channel`);
			}

			if (!guild.me.permissionsIn(channel).has(['SEND_MESSAGES', 'EMBED_LINKS'])) {
				this.disable(guild, tz);
				return client.log.console(`Disabled guild ${guild.id} - invalid permissions in channel`);
			}
			
			const i18n = new I18n(settings.locale || 'en-GB');

			let xmas = new Christmas(settings.timezone),
				sleeps = xmas.sleeps;

			let text = i18n.__('christmas.sleeps.text', sleeps),
				footer = i18n.__('christmas.footer', client.config.website.pretty, client.config.website.url);

			let embed = new Embed(null, settings)
				.setURL(client.config.website.url + '/total#sleeps')
				.setDescription(text + '\n\n' + footer)
				.setTimestamp();

			if (xmas.isToday)
				embed
					.setTitle(i18n.__('christmas.xmas_day'))
					.setDescription(`${text}\n\n${i18n.__('christmas.merry_xmas')}\n\n${footer}`);
			else if (xmas.isTomorrow)
				embed
					.setTitle(i18n.__('christmas.xmas_eve'));
			else
				embed
					.setTitle(i18n.__('christmas.sleeps.title', sleeps));

			try {
				if (settings.premium && settings.mention && settings.role) {
					channel.send(`<@&${settings.role}>`, embed);
				} else {
					channel.send(embed);
				}

				// update last sent timestamp in database
				client.db.Guild.update({
					last: new Date(now.format('iso'))
				}, {
					where: {
						id: guild.id
					}
				});
				client.log.console(`Sent countdown to guild ${guild.id}`);
				await utils.wait(200);
			} catch (e) {
				client.log.warn(`Failed to send countdown to guild ${guild.id}`);
				client.log.error(e);
			}

		});
		client.log.success(`Sent countdown to ${number} guilds`);
	}
};