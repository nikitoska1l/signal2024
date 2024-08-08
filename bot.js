const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const keys = require('./service-account-key.json'); // путь к вашему JSON-файлу

// Замените на ваш токен бота
const TOKEN = '7305575234:AAF02cgbPWlXzM1hFnO0hudEUZFT38PO5TM';
const bot = new TelegramBot(TOKEN, { polling: true });

const client = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth: client });

const SPREADSHEET_ID = '1qNp9fVSdSV5pX_KLtgKkiSf6byl0LjEQOwmI3EU2BF0'; // ID вашей таблицы

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

console.log('Бот успешно запущен и готов к работе');
