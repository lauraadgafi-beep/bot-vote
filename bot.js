const {
  Client, GatewayIntentBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const { createCanvas, registerFont } = require('canvas');
const ROBOTO_B64 = require('./font');
const os = require('os');
const path = require('path');

// Enregistrer la police depuis base64
const fontPath = path.join(os.tmpdir(), 'roboto.ttf');
if (!require('fs').existsSync(fontPath)) {
  require('fs').writeFileSync(fontPath, Buffer.from(ROBOTO_B64, 'base64'));
}
try { registerFont(fontPath, { family: 'Roboto' }); } catch(e) { console.error('Font error:', e.message); }

const config = {
  token: process.env.DISCORD_TOKEN,
  candidatureChannelId: '1506784851477401713',
  voteChannelId: '1506799242109521920',
  roleAccepte: '1506832146143117435',
  roleAdmin: '1507037344224641054',
  roleNotif: '1506790374297960522',
  salondAccepte: '1507126663635271801',
  salondRefuse: '1506784851477401713',
  votesRequis: 5,
};

let votes = {};
const SAVE_FILE = './votes.json';

function sauvegarder() {
  fs.writeFileSync(SAVE_FILE, JSON.stringify({ votes, config: { votesRequis: config.votesRequis } }, null, 2));
}

function charger() {
  if (fs.existsSync(SAVE_FILE)) {
    const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
    votes = data.votes || {};
    if (data.config?.votesRequis) config.votesRequis = data.config.votesRequis;
  }
}

function getPhrase(total, requis) {
  if (total === 0) return "🥱 L'assemblée est en train de se toucher les couilles, personne n'est disponible pour voter.";
  if (total === 1) return "👀 L'assemblée est en train de s'assembler.";
  const phrasesMilieu = [
    "☕ Je crois que l'assemblée a fini la pause café.",
    "🧐 L'assemblée se réveille doucement...",
    "🗣️ Les langues se délient au sein de l'assemblée.",
    "⚖️ L'assemblée délibère avec sérieux (ou presque).",
    "🍺 L'assemblée a fini son verre et vote.",
    "😤 L'assemblée s'est enfin décidée à se bouger.",
    "🎲 Les dés roulent dans les couloirs de l'assemblée.",
  ];
  if (total < requis - 1) return phrasesMilieu[(total - 2) % phrasesMilieu.length];
  if (total === requis - 1) return "😤 L'assemblée a presque terminé, on y croyait plus...";
  if (total >= requis) return "⚡ Verdict imminent.";
  return "🗳️ L'assemblée délibère...";
}

function barreProgression(total, requis) {
  const rempli = Math.min(total, requis);
  const vide = requis - rempli;
  const pct = Math.min(Math.round((total / requis) * 100), 100);
  return `${'🔴'.repeat(rempli)}${'⚫'.repeat(vide)} **${total}/${requis}** votes (${pct}%)`;
}

async function genererGraphique(voteData) {
  const votants = Object.values(voteData.votes).map(v => {
    const label = (v.type === 'ouaip' || v.type === 'reco') ? '✅ Ouaip' : '❌ Nop';
    const badge = v.type === 'reco' ? ' ⭐' : v.type === 'veto' ? ' 🦝' : '';
    return { username: v.username, label, badge };
  });

  const oui = Object.values(voteData.votes).filter(v => v.type === 'ouaip' || v.type === 'reco').length;
  const non = Object.values(voteData.votes).filter(v => v.type === 'nop' || v.type === 'veto').length;
  const total = oui + non;
  const aVeto = Object.values(voteData.votes).some(v => v.type === 'veto');
  const accepte = !aVeto && oui > non;
  const egalite = !aVeto && oui === non;
  const pctOui = total > 0 ? Math.round((oui / total) * 100) : 0;
  const pctNon = total > 0 ? Math.round((non / total) * 100) : 0;

  const W = 580;
  const ligneVotant = 28;
  const paddingTop = 60;
  const listeH = Math.max(votants.length * ligneVotant, 30);
  const H = paddingTop + listeH + 100 + 90;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e1f22';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Roboto';
  ctx.textAlign = 'center';
  ctx.fillText(`Résultats — Candidature de ${voteData.candidatTag}`, W / 2, 35);

  ctx.strokeStyle = '#3f3f45';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 48); ctx.lineTo(W - 20, 48); ctx.stroke();

  votants.forEach((v, i) => {
    const y = paddingTop + i * ligneVotant;
    ctx.textAlign = 'left';
    ctx.font = '14px Roboto';
    ctx.fillStyle = v.label.includes('Ouaip') ? '#57f287' : '#ed4245';
    ctx.fillText(v.label, 20, y + 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${v.username}${v.badge}`, 110, y + 18);
  });

  const barreY = paddingTop + listeH + 10;
  ctx.strokeStyle = '#3f3f45';
  ctx.beginPath(); ctx.moveTo(20, barreY); ctx.lineTo(W - 20, barreY); ctx.stroke();

  const barreStartY = barreY + 15;
  const barreMaxW = W - 160;
  const barreH = 26;

  const dessinerBarre = (label, valeur, couleur, y) => {
    ctx.fillStyle = '#b5bac1'; ctx.font = 'bold 13px Roboto'; ctx.textAlign = 'right';
    ctx.fillText(label, 95, y + barreH / 2 + 5);
    ctx.fillStyle = '#2b2d31'; ctx.beginPath(); ctx.roundRect(100, y, barreMaxW, barreH, 6); ctx.fill();
    if (valeur > 0) {
      ctx.fillStyle = couleur; ctx.beginPath();
      ctx.roundRect(100, y, Math.max((valeur / total) * barreMaxW, 8), barreH, 6); ctx.fill();
    }
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.font = 'bold 13px Roboto';
    const pct = total > 0 ? Math.round((valeur / total) * 100) : 0;
    ctx.fillText(`${valeur} (${pct}%)`, 100 + barreMaxW + 8, y + barreH / 2 + 5);
  };

  dessinerBarre('Ouaip', oui, '#57f287', barreStartY);
  dessinerBarre('Nop', non, '#ed4245', barreStartY + barreH + 14);

  const verdictY = barreStartY + barreH + 14 + barreH + 18;
  ctx.strokeStyle = '#3f3f45';
  ctx.beginPath(); ctx.moveTo(20, verdictY); ctx.lineTo(W - 20, verdictY); ctx.stroke();

  const verdictTexte = egalite ? '⚖️ ÉGALITÉ' : accepte ? 'ACCEPTÉ 🎉' : 'REFUSÉ ❌';
  const verdictCouleur = egalite ? '#fee75c' : accepte ? '#57f287' : '#ed4245';
  ctx.fillStyle = verdictCouleur;
  ctx.font = 'bold 36px Roboto';
  ctx.textAlign = 'center';
  ctx.fillText(verdictTexte, W / 2, verdictY + 50);

  if (aVeto) {
    const veteurs = Object.values(voteData.votes).filter(v => v.type === 'veto').map(v => v.username);
    ctx.fillStyle = '#b5bac1'; ctx.font = 'italic 13px Roboto';
    ctx.fillText(`🦝 Véto posé par : ${veteurs.join(', ')}`, W / 2, verdictY + 72);
  }

  return canvas.toBuffer('image/png');
}

function construireEmbedEnCours(voteData, egalite = false) {
  const total = Object.keys(voteData.votes).length;
  const phrase = egalite
    ? '⚖️ **ÉGALITÉ !** Les votes sont à égalité, un nouveau tour est lancé. Revotez !'
    : getPhrase(total, config.votesRequis);
  const embed = new EmbedBuilder()
    .setColor(egalite ? 0xfee75c : 0x5865f2)
    .setTitle(`🏛️ Candidature de ${voteData.candidatTag}`)
    .setDescription(`> ${voteData.message}\n\n${barreProgression(total, config.votesRequis)}\n\n*${phrase}*`)
    .setFooter({ text: `Vote en cours — délibérez, crapules !` });
  if (voteData.avatarUrl) embed.setThumbnail(voteData.avatarUrl);
  return embed;
}

function construireEmbedFinal(voteData) {
  const aVeto = Object.values(voteData.votes).some(v => v.type === 'veto');
  const oui = Object.values(voteData.votes).filter(v => v.type === 'ouaip' || v.type === 'reco').length;
  const non = Object.values(voteData.votes).filter(v => v.type === 'nop' || v.type === 'veto').length;
  const accepte = !aVeto && oui > non;
  return new EmbedBuilder()
    .setColor(accepte ? 0x57f287 : 0xed4245)
    .setTitle(`🏛️ Candidature de ${voteData.candidatTag}`)
    .setDescription(`> ${voteData.message}`)
    .setImage('attachment://resultats.png');
}

function construireBoutons(desactive = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vote_ouaip').setLabel('Ouaip').setStyle(ButtonStyle.Success).setDisabled(desactive),
    new ButtonBuilder().setCustomId('vote_nop').setLabel('Nop').setStyle(ButtonStyle.Danger).setDisabled(desactive),
    new ButtonBuilder().setCustomId('vote_reco').setLabel('⭐ Recommandation').setStyle(ButtonStyle.Primary).setDisabled(desactive),
    new ButtonBuilder().setCustomId('vote_veto').setLabel('🦝 VÉTO').setStyle(ButtonStyle.Primary).setDisabled(desactive),
  );
}

async function gererFinDeVote(interaction, voteData) {
  const aVeto = Object.values(voteData.votes).some(v => v.type === 'veto');
  const oui = Object.values(voteData.votes).filter(v => v.type === 'ouaip' || v.type === 'reco').length;
  const non = Object.values(voteData.votes).filter(v => v.type === 'nop' || v.type === 'veto').length;
  const egalite = !aVeto && oui === non;
  const accepte = !aVeto && oui > non;

  if (egalite) {
    voteData.votes = {};
    voteData.clos = false;
    sauvegarder();
    await interaction.update({ embeds: [construireEmbedEnCours(voteData, true)], components: [construireBoutons()], files: [] });
    return;
  }

  voteData.clos = true;
  sauvegarder();

  const imgBuffer = await genererGraphique(voteData);
  const attachment = new AttachmentBuilder(imgBuffer, { name: 'resultats.png' });

  await interaction.update({ embeds: [construireEmbedFinal(voteData)], components: [construireBoutons(true)], files: [attachment] });

  try {
    const membre = await interaction.guild.members.fetch(voteData.candidatId);
    if (accepte) await membre.roles.add(config.roleAccepte);
    else await membre.roles.remove(config.roleAccepte).catch(() => {});
  } catch (e) { console.error('Erreur rôle :', e.message); }

  try {
    const salondId = accepte ? config.salondAccepte : config.salondRefuse;
    const salon = await interaction.guild.channels.fetch(salondId);
    const texte = accepte
      ? `Salut <@${voteData.candidatId}> 😏 🦝 Bienvenue parmi l'élite, restons loin de la plèbe entre vraies crapules.`
      : `<@${voteData.candidatId}> ESPECE DE GROS LOOSER ON VEUT PAS DE TOI`;
    const msg = await salon.send({ content: texte, allowedMentions: { users: [voteData.candidatId] } });
    setTimeout(() => msg.delete().catch(() => {}), 60000);
  } catch (e) { console.error('Erreur message post-vote :', e.message); }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const sessionsConfig = new Map();

client.once('ready', () => {
  charger();
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (sessionsConfig.has(message.author.id) && message.channelId === sessionsConfig.get(message.author.id)) {
    const nb = parseInt(message.content.trim());
    try { await message.delete(); } catch {}
    if (isNaN(nb) || nb < 1) {
      const err = await message.channel.send('❌ Nombre invalide.');
      setTimeout(() => err.delete().catch(() => {}), 4000);
      return;
    }
    sessionsConfig.delete(message.author.id);
    config.votesRequis = nb;
    sauvegarder();
    const confirm = await message.channel.send(`✅ Votes requis mis à jour : **${nb}**`);
    setTimeout(() => confirm.delete().catch(() => {}), 5000);

    const voteChannel = await client.channels.fetch(config.voteChannelId);
    for (const [msgId, voteData] of Object.entries(votes)) {
      if (voteData.clos) continue;
      try {
        const voteMessage = await voteChannel.messages.fetch(msgId);
        const total = Object.keys(voteData.votes).length;
        if (total >= nb) {
          const aVeto = Object.values(voteData.votes).some(v => v.type === 'veto');
          const oui = Object.values(voteData.votes).filter(v => v.type === 'ouaip' || v.type === 'reco').length;
          const non = Object.values(voteData.votes).filter(v => v.type === 'nop' || v.type === 'veto').length;
          if (!aVeto && oui === non) {
            voteData.votes = {};
            await voteMessage.edit({ embeds: [construireEmbedEnCours(voteData, true)], components: [construireBoutons()] });
          } else {
            voteData.clos = true; sauvegarder();
            const imgBuffer = await genererGraphique(voteData);
            const attachment = new AttachmentBuilder(imgBuffer, { name: 'resultats.png' });
            await voteMessage.edit({ embeds: [construireEmbedFinal(voteData)], components: [construireBoutons(true)], files: [attachment] });
          }
        } else {
          await voteMessage.edit({ embeds: [construireEmbedEnCours(voteData)], components: [construireBoutons()] });
        }
      } catch (e) { console.error('Erreur maj vote :', e.message); }
    }
    return;
  }

  if (message.content.toUpperCase() === 'CRAPULE VOTE') {
    if (!message.member.roles.cache.has(config.roleAdmin)) {
      const err = await message.reply('❌ Tu n\'as pas la permission, crapule.');
      setTimeout(() => err.delete().catch(() => {}), 4000);
      try { await message.delete(); } catch {}
      return;
    }
    try { await message.delete(); } catch {}
    sessionsConfig.set(message.author.id, message.channelId);
    const prompt = await message.channel.send(`⚙️ <@${message.author.id}> Combien de votes requis ? *(tape le nombre, ton message sera supprimé)*`);
    setTimeout(() => {
      if (sessionsConfig.has(message.author.id)) {
        sessionsConfig.delete(message.author.id);
        prompt.delete().catch(() => {});
      }
    }, 30000);
    return;
  }

  if (message.channelId !== config.candidatureChannelId) return;

  const voteChannel = await client.channels.fetch(config.voteChannelId);
  if (!voteChannel) return;

  const voteData = {
    candidatId: message.author.id,
    candidatTag: message.author.tag,
    message: message.content,
    avatarUrl: message.author.displayAvatarURL({ size: 128, extension: 'png' }),
    votes: {},
    clos: false,
  };

  const voteMessage = await voteChannel.send({
    content: `<@&${config.roleNotif}>`,
    embeds: [construireEmbedEnCours(voteData)],
    components: [construireBoutons()],
  });

  votes[voteMessage.id] = voteData;
  sauvegarder();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const voteData = votes[interaction.message.id];
  if (!voteData) return interaction.reply({ content: '❌ Vote introuvable.', ephemeral: true });
  if (voteData.clos) return interaction.reply({ content: '🔒 Vote clôturé.', ephemeral: true });

  const userId = interaction.user.id;
  if (voteData.votes[userId]) {
    return interaction.reply({ content: `❌ Tu as déjà voté. Un seul vote par personne !`, ephemeral: true });
  }

  const typeMap = { vote_ouaip: 'ouaip', vote_nop: 'nop', vote_reco: 'reco', vote_veto: 'veto' };
  const type = typeMap[interaction.customId];
  if (!type) return;

  voteData.votes[userId] = { type, username: interaction.user.username };

  if (Object.keys(voteData.votes).length >= config.votesRequis) {
    await gererFinDeVote(interaction, voteData);
  } else {
    sauvegarder();
    await interaction.update({ embeds: [construireEmbedEnCours(voteData)], components: [construireBoutons()] });
  }
});

client.login(config.token);


client.login(config.token);

