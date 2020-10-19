/**
 * @name christmascountdownbot
 * @author eartharoid <contact@eartharoid.me>
 * @copyright 2020 Isaac Saunders (eartharoid)
 * @license MIT
 */

const spacetime = require('spacetime');
const Christmas = require('./christmas');
const { Embed, i18n: i18nOptions } = require('../bot');

const { I18n } = require('i18n');
const i18n = new I18n(i18nOptions);

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
						diff = now.diff(last, 'hours');
					if (diff < 24) return; // return if last was less than 24h ago
				} else return; // return if no last
			}
		
			// either it is 00:00 - 00:59, or the last was sent over 24 hours ago
			// (meaning it's probably the morning and the bot was offline when it was meant to send)
			
			// let channel = await guild.channels.cache.get(settings.channel);
			let channel = await client.channels.fetch(settings.channel);
			
			if (!channel) {
				this.disable(guild);
				return client.log.console('Disabled guild with missing channel');
			}

			if (!guild.me.permissionsIn(channel).has(['SEND_MESSAGES', 'EMBED_LINKS'])) {
				this.disable(guild);
				return client.log.console('Disabled guild with invalid permissions in channel');
			}
			
			i18n.setLocale(settings.locale || 'en-GB');

			let xmas = new Christmas(false || settings.timezone),
				sleeps = xmas.sleeps;

			let text = i18n.__n('There is **%d** sleep left until Christmas!', 'There are **%d** sleeps left until Christmas!', sleeps),
				footer = i18n.__('View the live countdown at [%s](%s).', guild.client.config.website.pretty, guild.client.config.website.url);

			let embed = new Embed(false, settings)
				.setURL(guild.client.config.website.url + '/total#sleeps')
				.setDescription(text + '\n\n' + footer)
				.setTimestamp();

			if (xmas.isToday)
				embed
					.setTitle(i18n.__('It\'s Christmas Day! :tada:'))
					.setDescription(text + `\n\n${i18n.__('Merry Christmas!')}` + `\n\n${footer}`);
			else if (xmas.isTomorrow)
				embed
					.setTitle(i18n.__('It\'s Christmas Eve!'));
			else
				embed
					.setTitle(i18n.__n('%d sleep left', '%d sleeps left', sleeps));

			try {
				channel.send(embed);
			} catch (e) {
				guild.client.log.error(e);
			}

		});
	}
	/* run: async (client) => {
		let guilds = await client.db.Guild.findAll({
			where: {
				[or]: [
					{ enabled: true },
					{ auto: true }
				]
			}
		});
		for (let row in guilds.rows) {
			row = guilds.rows[row];
			let guild = await client.guilds.fetch(row.id);
			if (!guild) continue; // the guild could be on another shard
			if (row.auto) {
				await this.auto(guild);
				row = await guild.settings(); // equivalent to findOne by id
			}
			if (!row.enabled) continue; // if was auto and its not Advent
			// check the time
		}
	} */
};