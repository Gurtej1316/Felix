/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/

/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CONVERSATIONS_ARN
	STORAGE_CONVERSATIONS_NAME
	STORAGE_CONVERSATIONS_STREAMARN
	STORAGE_ORGUSER_ARN
	STORAGE_ORGUSER_NAME
	STORAGE_ORGUSER_STREAMARN
Amplify Params - DO NOT EDIT */

const AWS = require('aws-sdk');
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
var s3 = new AWS.S3({
  signatureVersion: "v4"
});

const { searchService, aggregateService, exportService } = require('./conversationServices');
const { pickObjectProperty } = require("@commonutils/pick");
AWS.config.update({ region: process.env.TABLE_REGION });
const { S3Bucket } = require('@commonutils/constants');
const { getS3SignedURL } = require("@commonutils/s3");
const path = "/conversations";

var bodyParser = require('body-parser');
var express = require('express');
var app = express();// declare a new express app
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
 * Handler function to search conversations data.
 * endpoint: /conversations/:orgId/search
 */
 app.post(path + '/:orgId/search', async (req, res) => {
  const searchOptions = pickObjectProperty(req.body, [ "offset", "limit", "sortBy", "sortOrder", "filters", "mustNotFilters" ]);
  const periodFilter = req.body.periodFilter;
  const aggregateOptions = req.body.aggregations;
  console.log("searchOptions : " , JSON.stringify(searchOptions) , "periodFilter : ", JSON.stringify(periodFilter) , "aggregateOptions : " , JSON.stringify(aggregateOptions));

  let result = {};
  if(aggregateOptions){
    const response = await aggregateService.getAggregatedResults(req.params.orgId, searchOptions, periodFilter, aggregateOptions);
    result['data'] = Object.values(response);
  }
  else{
    result = await searchService.getSearchResults(req.params.orgId, searchOptions, periodFilter);
  }
  res.json(result); 
});

/**
 * Handler function to get unique column values.
 * endpoint: /conversations/:orgId/unique
 */
 app.post(path + '/:orgId/unique', async (req, res) => {
  const properties = req.body.properties;
  const filters = await searchService.getPropertyUniqueValues(req.params.orgId, properties);
  res.json(filters); 
});


/**
 * Handler function to export conversations data.
 * endpoint: /conversations/:orgId/export
 */
 app.post(path + '/:orgId/export', async (req, res) => {
  const searchOptions = pickObjectProperty(req.body, [ "sortBy", "sortOrder", "filters" ]);
  const responseType = req.body.responseType;
  const result = await exportService.getExportResults(req.params.orgId, searchOptions);
  const fileKey = await exportService.getExportS3FileKey(req.params.orgId, result.data, responseType);
  res.send({
    key: fileKey,
  });
});


/**
 * Handler function to import conversations data.
 * endpoint: /conversations/:orgId/import
 */
app.post(path + '/:orgId/import', async (req, res) => {
  if (req.body && req.body.fileType && req.body.fileEncoded) {
    var fileEncoded = req.body.fileEncoded.split(",");
    fileEncoded = fileEncoded[1];
    let fileToUpload = Buffer.from(fileEncoded, 'base64');
    const params = {
      Bucket: S3Bucket.CONVERSATION_DATA_UPLOAD,
      Key: req.body.fileName,
      Body: fileToUpload,
      ACL: 'public-read',
      ContentType: req.body.fileType
    };
    s3.upload(params, function (err, data) {
      if (err) {
        console.log('There was an error uploading your file: ', err);
        res.json({ error: "Error uploading file to s3" });
      }
      console.log('Successfully uploaded file.', data);
      res.json({ success: `File uploaded successfully ` });
    });
  }
  else {
    res.json({ error: "Error in fetching file data" });
    console.log("Error in fetching file data");
  }
});

/**
 * Handler function to fetch aggregate of Conversation  data.
 * endpoint: /conversations/:orgId/aggregate
 */
 app.post(path + '/:orgId/aggregate', async (req, res) => {
  const filterOptions = pickObjectProperty(req.body, [ "filters", "mustNotFilters" ]);
  const periodFilter = req.body.periodFilter;
  const aggregateOptions = req.body.aggregations;
  const execSummaryFlag = req.body.isInsightFetch;

  let result = await aggregateService.getAggregatedResults(
    req.params.orgId, filterOptions, periodFilter, aggregateOptions
  );
  if(result['averageScores'] && execSummaryFlag){
    let execSummary = await aggregateService.constructExecutiveSummary(result.averageScores, result?.sentimentScore ?? 0);
    let execSentimentSummary = "";
    if(result.sentiment){
      execSentimentSummary = await aggregateService.constructExecutiveSentimentSummary(result.sentiment);
    }
    result['execSummary'] = execSummary+ execSentimentSummary ?? "";
  }
  console.log(result);
  res.json(result);
});

/**
 * Handler function to fetch patterns of Conversation  data.
 * endpoint: /conversations/:orgId/pattern
 */
 app.post(path + '/:orgId/pattern', async (req, res) => {
 
  const filterOptions = pickObjectProperty(req.body, [ "filters" ]);
  const periodFilter = req.body.periodFilter;
  let aggregateOptions =  [{
      key: "patterns",
      type: "terms",
    }];
  
  if(req.body.isInsightFetch)
  {

    aggregateOptions.push( { key: "userId",
      type: "cardinality"})
    aggregateOptions.push(
      { key: "SK",
      type: "cardinality"});
      
  }

  let patternCounts = await aggregateService.getAggregatedResults(
    req.params.orgId, filterOptions, periodFilter, aggregateOptions
  );
  if(patternCounts?.patterns && patternCounts?.patterns.length>0)
  {
    const searchOptions = {filters:[
      { key: "orgId", type: 'exact', value: [req.params.orgId ]},
      { key: "patternId", type: 'exact', value: patternCounts.patterns.map(a => a.label)}
      ] };

     const result = await searchService.getPatternDetails(searchOptions);
     
     let returnObj = {pattern: result?.data?.map(pattern => {
        return {label: pattern.summary,
        patternId: pattern.patternId,
        count: (patternCounts.patterns.filter(obj => {
          return obj.label === pattern.patternId}))[0]?.count,
        sentiment: pattern.patternType};
       })};
     
      if(req.body.isInsightFetch)
      {
        returnObj.positiveTopics = returnObj.pattern?.filter((obj) => obj.sentiment === 'positive').length;
        returnObj.improveTopicCount = returnObj.pattern?.filter((obj) => obj.sentiment === 'opportunity').length;
        returnObj.pattern=undefined;
        returnObj.people = patternCounts?.userId?.value;
        returnObj.interactions = patternCounts?.SK?.value;
      }
     
     
     
     res.json(returnObj);
  }
  else
  {
    res.json([]);
  }
  
});


/**
 * Handler function to return Sentiment chart data.
 * endpoint: /conversations/:orgId/sentimentChart
 */
 app.post(path + '/:orgId/sentimentChart', async (req, res) => {

  if(req.body.filter){
    var searchOptions = pickObjectProperty(req.body.filter, [ "offset", "limit", "sortBy", "sortOrder", "filters", "mustNotFilters" ]);
    var periodFilter = req.body.filter.periodFilter;
    var aggregateOptions = req.body.filter.aggregations;
    console.log("In "+ path + "/:orgId/sentimentChart , searchOptions : " , JSON.stringify(searchOptions) , "periodFilter : ", JSON.stringify(periodFilter) , "aggregateOptions : " , JSON.stringify(aggregateOptions));
  }
  let response;
  if(aggregateOptions){
    response = await aggregateService.getAggregatedResults(req.params.orgId, searchOptions, periodFilter, aggregateOptions);
  }
  let neutralCount;
  let negativeCount;
  let positiveCount;
  if(response.sentiment){
      for(let index in response.sentiment){
          if( response.sentiment[index].label === 'NEUTRAL'){
              neutralCount =  response.sentiment[index].count ?? 0;
          }else  if( response.sentiment[index].label === 'POSITIVE'){
              positiveCount =  response.sentiment[index].count ?? 0;
          }else  if( response.sentiment[index].label === 'NEGATIVE'){
              negativeCount =  response.sentiment[index].count ?? 0;
          }
      }
  }
   const responses = {
    averageScore: response?.sentimentScore.avg ? Math.round(response.sentimentScore.avg * 10) / 10 : 0,
    totalConversations: response?.sentimentScore.count ? response.sentimentScore.count: 0,
    userCount: response?.userId?.value ? response.userId.value: 0,
    neutralCount:neutralCount,
    negativeCount:negativeCount,
    positiveCount:positiveCount
  }  
  console.log("/sentimentChart - response :" ,responses );
  res.json(responses); 
});
// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app