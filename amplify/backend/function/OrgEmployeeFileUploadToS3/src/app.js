/* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_EMPLOYEEFILELIST_BUCKETNAME
  STORAGE_ORG_ARN
  STORAGE_ORG_NAME
  STORAGE_ORG_STREAMARN
Amplify Params - DO NOT EDIT *//*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/



const AWS = require('aws-sdk');
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
var bodyParser = require('body-parser');
var express = require('express');
AWS.config.update({ region: process.env.TABLE_REGION });
var s3 = new AWS.S3({
  signatureVersion: "v4"
});
const fetch = require('node-fetch');
const EMPLOYEE_TEMPLATE_FILE_NAME = 'employees.csv';
const EMPLOYEE_TEMPLATE_FILE_BUCKET = 'employee-file-template';
const path = "/employeeFile";

// declare a new express app
var app = express();
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(awsServerlessExpressMiddleware.eventContext());

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "*")
  next()
});

/**
 * Handler function to upload employee file to s3 bucket
 * endpoint: /employeeFile/upload
 */
app.post(path + '/upload', async function (req, res) {
  if(req.body && req.body.fileType && req.body.fileName){
    const contentType = req.body.fileType;
    const key =  req.body.fileName;
    var fileEncoded = req.body.fileEncoded.split(",");
    fileEncoded = fileEncoded[1]
    let fileToUpload = Buffer.from(fileEncoded, 'base64');
    const params = {
      Bucket: process.env.STORAGE_EMPLOYEEFILELIST_BUCKETNAME,
      Key: key,
      Expires: 500,
      ContentType: contentType
    }
    console.log("s3 params for getting signed URL-",params);
    const uploadURL = await s3.getSignedUrl('putObject', params);
    if (uploadURL) {
      const response = await fetch(uploadURL, {
        method: 'PUT',
        body: fileToUpload,
        ContentEncoding: 'base64'
    })
    if (response) {
      console.log(`File uploaded successfully using signed url`);
      res.json({ success: `File uploaded successfully ` });
    }
    else {
      console.log("Error uploading file to s3",);
      res.json({ error: "Error uploading file to s3" });

    }
  }
  }
  else {
    res.json({ error: "Error in fetching file data" });
    console.log("Error in fetching file data");
  }
});

/**
 * Handler function to download employee file template from s3 bucket
 * endpoint: /employeeFile/download
 */
app.get(path + '/download', async function (req, res) {
  s3 = new AWS.S3({
    region: 'ap-southeast-1'
  });
  const signedUrl = s3.getSignedUrl("getObject", {
    Key: EMPLOYEE_TEMPLATE_FILE_NAME,
    Bucket: EMPLOYEE_TEMPLATE_FILE_BUCKET,
  });
  if(signedUrl){
    console.log("Successfully fetched signed URL FOR downloading template");
    res.json({success : "fetched signed url for employee file template successfully", signedURL : signedUrl});
  }
  else{
    res.json({error : "Failed to fetch signed url for employee file template"});
  }
});

app.listen(3000, function () {
  console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
