/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
admin.initializeApp(functions.config().firebase);
var db = admin.firestore();
const request = require('request-promise');
const express = require('express');
const exphbs = require('express-handlebars');
const app = express();
const firebaseUser = require('./firebaseUser');
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword
  }
});
const APP_NAME = 'Cloud Storage for Firebase quickstart';
app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use(firebaseUser.validateFirebaseIdToken);


app.post('/', (req, res) => {
  var url = '';
  var message = '';
  var status = '200';
  var sender = '';
  var msg1 = '';
  var apiKey = req.get('apiKey');
  var data = req.body;
  db.collection("brandInfo").where("apiKey", "==", apiKey)
    .get()
    .then(function (querySnapshot) {
      querySnapshot.forEach(function (doc) {
        if (doc.exists) {
          status = 200;
          data.regDetails = doc.data().regDetails;
          message = doc.data().smsText;
          sender = doc.data().senderId;
          msg1 = require("msg91")("API_KEY", sender, 4);
          return db.collection('invoices').add(data).then(function (docRef) {
            url = `https://us-central1-template1-efdb6.cloudfunctions.net/app/${docRef.id}`;
            console.log(url);
            return request(createShortenerRequest(url)).then(response => {
              if (response.statusCode == 200) {
                return response.body.id;
              }
              throw response.body;
            }).then(shortUrl => {
              message = message.replace("{{URL}}", shortUrl);
              msg91.send(data.customer.mobile_number, message, function (err, response) {
                console.log(err);
                console.log(response);
              });
            });
          });
        }
        else {
          status = 401;
        }
      });
      res.status(status);
      res.end();
    })
    .catch(function (error) {
      console.log("Error getting documents: ", error);
    });

});

function createShortenerRequest(sourceUrl) {
  return {
    method: 'POST',
    uri: `http://api.msg91.com/api/v2/sendsms?key=AIzaSyCs50GeVPcCPBoNmY6fNjZv4ldEyhH0X20`,
    body: {
      longUrl: sourceUrl
    },
    json: true,
    resolveWithFullResponse: true
  };
}

app.get('/:invoiceid', (req, res) => {
  var id = req.params.invoiceid;
  console.log('value of' + id);
  var docRef = db.collection('invoices').doc('' + id);
  docRef.get().then(function (doc) {
    if (doc.exists) {
      console.log(doc.data());
      res.render('user', doc.data());
    } else {
      console.log("No such document!");
    }
  }).catch(function (error) {
    console.log("Error getting document:", error);
  });
  //res.send('hello from invoice copy');

});

// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.https.onRequest(app);
