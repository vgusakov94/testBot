const TelegramBot = require("node-telegram-bot-api");
const port = process.env.PORT || 443;
const host = "0.0.0.0";
const externalUrl = process.env.CUSTOM_ENV_VARIABLE || "https://web-production-4d31.up.railway.app/";
const token = '5993412829:AAEMCxk_2MplGufZFb7Tog1CUXr3OYpgYIY';
const bot = new TelegramBot(token, {webHook: {port: port, host: host}});
bot.setWebHook(externalUrl + ':443/bot' + token);

let loginSF = process.env.SALESFORCE_LOGIN || 'minsk2.engineer0770@gmail.com';
let passwordSF = process.env.SALESFORCE_PASSWORD || '1970209Vgu';

const jsforce = require("jsforce");
let conn = new jsforce.Connection();

let contactId = "";
let chatId;
let changeMessageId;
let previousMessage;
let amount;
let description;
let dayToInsert;
let login;

let todayDay = new Date();
let month = todayDay.getMonth();
let monthName;
let year = todayDay.getFullYear();


function mainMenu(chatId, mesg) {
    const opts = {
        reply_markup: JSON.stringify({
            inline_keyboard: [
                [
                    {text: "Текущий баланс", callback_data: "balance"},
                    {text: "Создать карточку", callback_data: "new-card"}
                ]
            ]
        })
    };
    bot.sendMessage(chatId, mesg, opts).then(previousMessage = '');
}

function insertCard(cardDate, chatId) {
    bot.sendMessage(chatId, "Введите сумму: ").then((previousMessage = "amount"));
}

function getBalance(chatId) {
    conn.query(
        "SELECT Reminder__c FROM Monthly_Expense__c " +
        "WHERE Keeper__c = '" + contactId + "'",
        function (err, res) {
            if (err) {
                bot.sendMessage(msg.chat.id, "Query error ");
                return console.error("err", err);
            }
            let balance = 0;
            for (let i = 0; i < res.records.length; i++) {
                balance += res.records[i].Reminder__c;
            }
            balance = (Math.round(balance * 100) / 100).toFixed(2);
            bot.sendMessage(chatId, "Ваш баланс: " + balance + "$").then(previousMessage = '')
                .then(mainMenu(chatId, 'Выберите действие '));
        }
    );
}

bot.on("callback_query", callbackQuery => {
    let answer = callbackQuery.data;
    if (answer == "balance") {
        getBalance(chatId);
    } else if (answer == "new-card") {
        const opts = {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [
                        {text: "Сегодня", callback_data: "today"},
                        {text: "Календарь", callback_data: "calendar"},
                        {text: "Отмена", callback_data: "cancel"}
                    ]
                ]
            })
        };
        bot.sendMessage(chatId, "На какой день желаете создать карточку?", opts);
    } else if (answer == "today") {
        previousMessage = "today";
        dayToInsert = todayDay;
        insertCard(todayDay, chatId);
    } else if (answer == "calendar") {
        changeMonthName();
        sendCalendar(chatId);
    } else if (answer == "cancel") {
        mainMenu(chatId, 'Выберите действие ');
    } else if (answer == "<") {
        changeMessageId = callbackQuery.message.message_id;
        previousMonth();
    } else if (answer == ">") {
        changeMessageId = callbackQuery.message.message_id;
        nextMonth();
    } else if (answer >= 1 && answer <= 31) {
        getDate(answer);
    }
});

bot.on("message", msg => {
    if (msg.text == "/start") {
        previousMessage = "";
        // previousMessage = "";
        // conn.login(loginSF, passwordSF, function (err, res) {
        //     if (err) {
        //         bot.sendMessage(msg.chat.id, "Ошибка авторизации в Salesforce");
        //         return console.error(err);
        //     } else {
        //         bot.sendMessage(msg.chat.id, "Введите логин: ").then((previousMessage = "login"));
        //     }
        // })
        bot.sendMessage(msg.chat.id, "Привет!");
    } else if (previousMessage == "login") {
        login = msg.text;
        bot.sendMessage(msg.chat.id, "Введите пароль: ").then((previousMessage = "password"));
    } else if (previousMessage == "password") {
        let password = msg.text;
        conn.query(
            "SELECT Id, Name, Email FROM Contact " +
            "WHERE Email = '" + login + "' " +
            "AND Password__c = '" + password + "' " +
            "LIMIT 1",
            function (err, res) {
                if (err) {
                    return console.error("err", err);
                }

                if (res.records.length == 0) {
                    bot.sendMessage(msg.chat.id, "Неверный логин или пароль ").then((previousMessage = ""));
                    bot.sendMessage(msg.chat.id, "Введите логин: ").then((previousMessage = "login"));
                }

                contactId = res.records[0].Id;
                chatId = msg.chat.id;
                mainMenu(chatId, 'Авторизация прошла успешно!');
            }
        );
    } else if (previousMessage == "amount") {
        amount = msg.text;
        const amountRegex = /^-?\d+\.?\d*$/;
        if (amountRegex.test(amount) && amount > 0) {
            bot.sendMessage(msg.chat.id, "Введите описание: ").then((previousMessage = "description"));
        } else {
            bot.sendMessage(msg.chat.id, "Неверный ввод. Введите сумму: ").then((previousMessage = "amount"));
        }
    } else if (previousMessage == "description") {
        description = msg.text;
        cardDate = dayToInsert;
        conn.sobject("Expense_Card__c").create(
            {
                CardKeeper__c: contactId,
                CardDate__c: cardDate,
                Amount__c: amount,
                Description__c: description
            },
            function (err, ret) {
                if (err || !ret.success) {
                    return console.error(err, ret);
                }
                bot.sendMessage(msg.chat.id, "Карточка успешно добавлена! ").then(previousMessage = '')
                    .then(mainMenu(chatId, 'Выберите действие '));
            }
        );
    } else if (msg.text == "/exit") {
        previousMessage = "";
        bot.sendMessage(msg.chat.id, "Вы вышли из аккаунта").then((previousMessage = "login"));
    }
});

function showCalendar() {
    let numOfdays = getDays();
    let inlineCalendar = [];
    let topRow = [];
    let buttonLeft = new Object();

    buttonLeft.text = "<";
    buttonLeft.callback_data = "<";
    topRow.push(buttonLeft);

    let buttonYear = new Object();

    buttonYear.text = monthName + " " + year;
    buttonYear.callback_data = year;
    topRow.push(buttonYear);

    let buttonRight = new Object();

    buttonRight.text = ">";
    buttonRight.callback_data = ">";
    topRow.push(buttonRight);

    inlineCalendar.push(topRow);
    let row = [];
    for (let i = 1; i <= numOfdays; i++) {
        if (i % 7 == 0) {
            inlineCalendar.push(row);
            row = [];
        }

        let button = new Object();
        button.text = i.toString();
        button.callback_data = i;
        row.push(button);
    }
    inlineCalendar.push(row);
    return inlineCalendar;
}

function changeMonthName() {
    const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sept",
        "Oct",
        "Nov",
        "Dec"
    ];

    monthName = monthNames[month];
}

function getDays() {
    let numberOfMonths = 0;

    if (month == 3 || month == 5 || month == 8 || month == 10) {
        numberOfMonths = 30;
    } else if (month == 1) {
        if (year % 4 == 0) {
            numberOfMonths = 29;
        } else {
            numberOfMonths = 28;
        }
    } else {
        numberOfMonths = 31;
    }

    return numberOfMonths;
}

function previousMonth() {
    if (month == 0) {
        month = 11;
        year -= 1;
    } else {
        month -= 1;
    }
    changeMonthName();
    changeCalendar();
}

function nextMonth() {
    if (month == 11) {
        month = 0;
        year += 1;
    } else {
        month += 1;
    }
    changeMonthName();
    changeCalendar();
}

function getDate(answer) {
    let newDate = new Date(year, month, answer, 3);
    dayToInsert = newDate;
    insertCard(newDate, chatId);
}

function sendCalendar(chatId) {
    let inlineCalendar = showCalendar();
    const opts = {
        reply_markup: JSON.stringify({
            inline_keyboard: inlineCalendar
        })
    };
    bot.sendMessage(chatId, "Выберете дату: ", opts).then(previousMessage = '');
}

function changeCalendar() {
    let inlineCalendar = showCalendar();

    const opts = {
        chat_id: chatId,
        message_id: changeMessageId
    };

    bot.editMessageReplyMarkup(
        {
            inline_keyboard: inlineCalendar
        },
        opts
    );
}
