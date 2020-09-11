const { Structures } = require('discord.js');

Structures.extend('Guild', Guild => {
	class ExtendedGuild extends Guild {
		constructor(client, data) {
			super(client, data);


			this.settings = () => client.db.Guild.findOne({
				where: {
					id: this.id
				}
			});

			// disabled as ready and guildCreate event already cover this
			/* if (!this.settings()) {
				client.db.Guild.create(require('../models/guild').defaults(this));
				client.log.console(client.log.f(`Added '&7${this.name}&f' to the database`));
			} */


		}
	}

	return ExtendedGuild;
});