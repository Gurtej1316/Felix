/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CONVERSATIONS_ARN
	STORAGE_CONVERSATIONS_NAME
Amplify Params - DO NOT EDIT *//* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CONVERSATIONS_ARN
	STORAGE_CONVERSATIONS_NAME
	STORAGE_ORGCONVERSATION_ARN
	STORAGE_ORGCONVERSATION_NAME
Amplify Params - DO NOT EDIT */const AWS = require('aws-sdk')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')
var bodyParser = require('body-parser')
var express = require('express')
const conversationService = require('@searchutils/conversations');
const searchService = require('@searchutils/services');

AWS.config.update({ region: process.env.TABLE_REGION });

const dynamodb = new AWS.DynamoDB.DocumentClient();

//let tableName = "OrgConversation";
let tableName = "Conversations";
if(process.env.ENV && process.env.ENV !== "NONE") {
  tableName = tableName + '-' + process.env.ENV;
}

const userIdPresent = false; // TODO: update in case is required to use that definition
const partitionKeyName = "PK";
const partitionKeyType = "S";
const sortKeyName = "SK";
const sortKeyType = "S";
const hasSortKey = sortKeyName !== "";
const path = "/sentiment";
const UNAUTH = 'UNAUTH';
const hashKeyPath = '/:' + partitionKeyName;
const sortKeyPath = hasSortKey ? '/:' + sortKeyName : '';
// declare a new express app
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});

// convert url string param to expected Type
const convertUrlType = (param, type) => {
  switch(type) {
    case "N":
      return Number.parseInt(param);
    default:
      return param;
  }
}

/********************************
 * HTTP Get method for list objects *
 ********************************/

app.post(path + hashKeyPath, async function(req, res) {
  let orgId = "";
  if (userIdPresent && req.apiGateway) {
    orgId = req.apiGateway.event.requestContext.identity.cognitoIdentityId || UNAUTH;
  } else {
    try {
      orgId = convertUrlType(req.params[partitionKeyName], partitionKeyType);
    } catch (err) {
      res.statusCode = 500;
      res.json({ error: 'Wrong column type ' + err });
    }
  }

  var elasticSearchConditions;
  if(req.body && req.body.searchCond){
    elasticSearchConditions =  req.body.searchCond[0];
  }  
  elasticSearchConditions['PK'] = [orgId];
  elasticSearchConditions['SK'] = ['CONV#'];

  const updatedFilterQuery = await searchService.setElasticFilterQuery(elasticSearchConditions);
  let data = await conversationService.getFilteredConversationsForMultipleAttrVal(orgId, updatedFilterQuery)
  
  let sentimentResponse = {
    months: [],
    nuetralCount : 0,
    positiveCount :0,
    negativeCount : 0,
    overallSentiment: 0,
  };

  let monthAggr = [];
  let monthTotal = [];
  let userSet = new Set();
  console.log('data',JSON.stringify(data));

  if (data)
    {     
    for (const item of data)
      {    
        let dateInMonth = new Date(item.date).toLocaleDateString('fr-CA');
        userSet.add(item.userId);      
        let value  = 0.0;
        value = monthAggr[dateInMonth];
        let sum = monthTotal [dateInMonth];      
        if(!value)
        {
          value = 0.0;
        }
        if(!sum)
        {
          sum = 0;
        }          
        if(item.sentiment === "POSITIVE")
        {
          sentimentResponse.positiveCount ++;
        }
        else if(item.sentiment === "NEGATIVE")
        {
          sentimentResponse.negativeCount ++;
        }
        else
        {
          sentimentResponse.nuetralCount ++;
        }     
        value = value + item.sentimentScore;
        sum ++;
        monthAggr[dateInMonth]=value;
        monthTotal [dateInMonth] = sum;
        
      }
      
    }
    else{
      res.statusCode = 500;
      res.json({error: 'Could not load items: ' + err});
    }
    let jsonMonth = [];
      let index = 0;
      let totalScore = 0;
      for ( const key of Object.keys(monthAggr))
      {
        jsonMonth[index] ={
        month : key,
        score : monthAggr[key]/monthTotal[key]};
        totalScore =  totalScore + monthAggr[key]/monthTotal[key];
        index ++;
      }
        
      sentimentResponse.months = jsonMonth;
      sentimentResponse.uniqueResponses = userSet.size;
      sentimentResponse.averageScore = totalScore / index;
      console.log("sentimentResponse ", sentimentResponse);
      res.json(sentimentResponse);
});

app.listen(3000, function() {
  console.log("App started")
});

module.exports = app
