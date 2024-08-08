require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const service_account_key = require('./service-account-key.json');

const app = express();
const PORT = process.env.PORT || 10000;

function dumpError(err) { 
  if (typeof err === 'object') { 
    if (err.message) { 
      console.log('\nMessage: ' + err.message) 
    } 
    if (err.stack) { 
      console.log('\nStacktrace:') 
      console.log('====================') 
      console.log(err.stack); 
    } 
  } else { 
    console.log('dumpError :: argument is not an object'); 
  } 
}

try {
  const serviceAccountKey = JSON.parse(service_account_key);

  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const bot = new TelegramBot(TOKEN, { polling: true });

  const client = new google.auth.JWT(
    serviceAccountKey.client_email,
    null,
    serviceAccountKey.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth: client });
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

  async function getSheetData(sheetName, range = 'A2:D') {
    const request = {
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    };

    try {
      const response = (await sheets.spreadsheets.values.get(request)).data;
      return response.values || [];
    } catch (err) {
      console.error('The API returned an error: ' + err);
      return [];
    }
  }

  function getDateIndexMap(data) {
    const dateIndexMap = {};
    let currentDate = null;

    data.forEach((row, index) => {
      if (row[0]) {
        currentDate = row[0];
      }
      if (!dateIndexMap[currentDate]) {
        dateIndexMap[currentDate] = [];
      }
      dateIndexMap[currentDate].push(index);
    });

    return dateIndexMap;
  }

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = "Привет, рейвер! Этот бот поможет тебе узнать расписание сетов на всех сценах Signalа. Выбери нужную сцену или получи инфо о событиях на территории.";

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Сцены', callback_data: 'scenes' }],
          [{ text: 'События', callback_data: 'events' }],
        ],
      },
    };

    bot.sendMessage(chatId, welcomeMessage, options);
  });

  bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    if (data === 'scenes') {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Möbius', callback_data: 'Möbius' }],
            [{ text: 'Meadow', callback_data: 'Meadow' }],
            [{ text: 'Kiosko', callback_data: 'Kiosko' }],
            [{ text: 'Signal', callback_data: 'Signal' }],
            [{ text: 'Rodnya', callback_data: 'Rodnya' }],
            [{ text: 'Ghosty', callback_data: 'Ghosty' }],
            [{ text: 'Flower', callback_data: 'Flower' }],
            [{ text: 'Prizma', callback_data: 'Prizma' }],
            [{ text: 'Назад', callback_data: 'back_to_main' }],
          ],
        },
      };
      bot.editMessageText('Выбери сцену:', { chat_id: message.chat.id, message_id: message.message_id, ...options });
    } else if (data === 'events') {
      const eventsData = await getSheetData('События');
      const dateIndexMap = getDateIndexMap(eventsData);
      const dateButtons = Object.keys(dateIndexMap).map(date => [{ text: date, callback_data: `event_date_${date}` }]);

      bot.editMessageText('Выбери дату:', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [...dateButtons, [{ text: 'Назад', callback_data: 'back_to_main' }]] } });
    } else if (data.startsWith('event_date_')) {
      const date = data.split('_')[2];
      const eventsData = await getSheetData('События');
      const dateIndexMap = getDateIndexMap(eventsData);

      let response = `События - <b>${date}</b>:\n\n`;
      dateIndexMap[date].forEach(index => {
        const row = eventsData[index];
        response += `<b>${row[1]}</b> - ${row[2]}\n<b>Место</b>: ${row[3]}\n\n`;
      });

      bot.editMessageText(response, { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: 'Назад', callback_data: 'events' }]] } });
    } else if (data === 'back_to_main') {
      const welcomeMessage = "Привет, рейвер! Этот бот поможет тебе узнать расписание сетов на всех сценах Signalа. Выбери нужную сцену или получи инфо о событиях на территории.";

      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Сцены', callback_data: 'scenes' }],
            [{ text: 'События', callback_data: 'events' }],
          ],
        },
      };

      bot.editMessageText(welcomeMessage, { chat_id: message.chat.id, message_id: message.message_id, ...options });
    } else if (data.startsWith('stage_')) {
      const stage = data.split('_')[1];
      const stageData = await getSheetData(stage);

      if (stageData.length === 0) {
        bot.editMessageText('Данные не найдены или произошла ошибка при получении данных.', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [[{ text: 'Назад', callback_data: 'back_to_scenes' }]] } });
        return;
      }

      const dateIndexMap = getDateIndexMap(stageData);
      const dateButtons = Object.keys(dateIndexMap).map(date => [{ text: date, callback_data: `date_${stage}_${date}` }]);

      bot.editMessageText('Выбери дату:', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [...dateButtons, [{ text: 'Назад', callback_data: 'back_to_scenes' }]] } });
    } else if (data.startsWith('date_')) {
      const [_, stage, date] = data.split('_');
      const stageData = await getSheetData(stage);
      const dateIndexMap = getDateIndexMap(stageData);

      let response = `<b>${stage}</b> - <b>${date}</b>:\n\n`;
      dateIndexMap[date].forEach(index => {
        const row = stageData[index];
        response += `<b>${row[1]}</b> - ${row[2]}\n`;
      });

      bot.editMessageText(response, { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: 'Назад', callback_data: `stage_${stage}` }]] } });
    } else if (data === 'back_to_scenes') {
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Möbius', callback_data: 'Möbius' }],
            [{ text: 'Meadow', callback_data: 'Meadow' }],
            [{ text: 'Kiosko', callback_data: 'Kiosko' }],
            [{ text: 'Signal', callback_data: 'Signal' }],
            [{ text: 'Rodnya', callback_data: 'Rodnya' }],
            [{ text: 'Ghosty', callback_data: 'Ghosty' }],
            [{ text: 'Flower', callback_data: 'Flower' }],
            [{ text: 'Prizma', callback_data: 'Prizma' }],
            [{ text: 'Назад', callback_data: 'back_to_main' }],
          ],
        },
      };
      bot.editMessageText('Выбери сцену:', { chat_id: message.chat.id, message_id: message.message_id, ...options });
    } else {
      const stage = data;
      const stageData = await getSheetData(stage);

      if (stageData.length === 0) {
        bot.editMessageText('Данные не найдены или произошла ошибка при получении данных.', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [[{ text: 'Назад', callback_data: 'back_to_scenes' }]] } });
        return;
      }

      const dateIndexMap = getDateIndexMap(stageData);
      const dateButtons = Object.keys(dateIndexMap).map(date => [{ text: date, callback_data: `date_${stage}_${date}` }]);

      bot.editMessageText('Выбери дату:', { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: [...dateButtons, [{ text: 'Назад', callback_data: 'back_to_scenes' }]] } });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (e) {
    console.warn('Error:', e.message)

    // We iterate through all the files 
    // mentioned in the error stack and 
    // find the line and line number 
    // that resulted in the error
    e.stack
        .split('\n')
        .slice(1)
        .map(r => r.match(/\((?<file>.*):(?<line>\d+):(?<pos>\d+)\)/))
        .forEach(r => {
            if (r && r.groups && r.groups.file.substr(0, 8) !== 'internal') 
            {
                const { file, line, pos } = r.groups
                const f = fs.readFileSync(file, 'utf8').split('\n')
                console.warn('  ', file, 'at', line + ':' + pos)
                console.warn('    ', f[line - 1].trim())
            }
        })
  process.exit(1);
}
