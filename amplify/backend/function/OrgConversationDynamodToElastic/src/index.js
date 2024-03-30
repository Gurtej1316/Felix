/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	STORAGE_CONVERSATIONS_ARN
	STORAGE_CONVERSATIONS_NAME
	STORAGE_CONVERSATIONS_STREAMARN
Amplify Params - DO NOT EDIT */const axios = require('axios');
const AWS = require('aws-sdk');

const workflowService = require('@searchutils/workflow');

// DynamoDB Configurations
const orgIdName = 'PK';
const recordIdName = 'SK';

const {ElasticClusterConfig, ElasticIndices, ElasticIndexTypes} = require('@searchutils/models');

exports.handler = async (event, context) => {
    const ElasticClusterConfigData= await ElasticClusterConfig;
    const url = `${ElasticClusterConfigData.node}/${ElasticIndices.conversations}/_doc/`;
    const workflowsURL = `${ElasticClusterConfigData.node}/${ElasticIndices.workflows}/${ElasticIndexTypes.workflows}/`;
    let count = 0;
    for (const record of event.Records) {
        const id = encodeURIComponent(record.dynamodb.Keys[orgIdName].S+"-"+record.dynamodb.Keys[recordIdName].S);
        try {
            if (record.eventName === 'REMOVE') {
                await axios.delete(url + id, { auth: ElasticClusterConfigData.auth });
                return 'Item removed';
            }
            else {
                const document = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
                console.log('Inside OrgConversationDynamoToElastic() - Saving conversation: ',document);
                let a = await axios.put(url + id, document, { auth: ElasticClusterConfigData.auth });
                // if(document.SK.startsWith('CONV#')){
                //     await setCampaignDetails(workflowsURL,  document, record,ElasticClusterConfigData);
                // }

            }
        } catch (error) {
            console.error(error);
            console.log('Failed to update a record in Elastic');
            console.log('Continuing with other records');
        }
        count += 1;
    }
    return `Successfully processed ${count} records.`;
};

async function setCampaignDetails(url, document, record, ElasticClusterConfigData) {
    console.log('inside setCampaignDetails()');
    console.log('event:',record.eventName);
    let orgId = document.PK;
    const campaignRecordId = encodeURIComponent(orgId+"-"+document.campaignId);
    var searchCond = [];

    let searchterm = {
        match: {'workflowId.keyword' : document.campaignId}
      };
    searchCond.push(searchterm);
    let options = {searchCond : searchCond};
    let result =  await workflowService.getExecutedWorkflowListFromSearch(orgId, options);
    console.log("Campaign Entity Returned: ",result.items);
    result = result.items;
    if(result && result[0]){
        let data = result[0];
        //patterns
        if(document.associatedPatternObj && document.associatedPatternObj.pattern && document.associatedPatternObj.patternType){
            //case when there is an associated pattern with the CONV data object
            if(document.associatedPatternObj.patternType === 'positive'){
                //positive pattern is associated with the conversation
                if(data.pattern && data.pattern[0]){
                    //case when there is a patterns array already populated for the 
                    if(data.pattern[0].positivePattern){
                        //case when positivePattern key value exists
                        if(data.pattern[0].positivePattern.indexOf(document.associatedPatternObj.pattern)<0){
                            data.pattern[0].positivePattern.push(document.associatedPatternObj.pattern);
                        }
                    }else{
                        //case when patterns array is present but not the positive KV pair
                        let tempArray = [];
                        tempArray.push(document.associatedPatternObj.pattern);
                        data.pattern[0].positivePattern = tempArray;
                    }
                } else{
                    //case when pattern attribute is not present
                    let tempArray = [];
                    let tempJSONObj = {};
                    tempJSONObj.positivePattern = [];
                    tempJSONObj.positivePattern.push(document.associatedPatternObj.pattern);
                    tempArray.push(tempJSONObj);
                    data.pattern = tempArray;
                }
            }
            else if (document.associatedPatternObj.patternType === 'opportunity'){
                //improvement pattern is associated with the conversation
                if(data.pattern && data.pattern[0]){
                    //case when there is a patterns array already populated for the 
                    if(data.pattern[0].negativePattern){
                        //case when negativePattern key value exists
                        if(data.pattern[0].negativePattern.indexOf(document.associatedPatternObj.pattern)<0){
                            data.pattern[0].negativePattern.push(document.associatedPatternObj.pattern);
                        }
                    }else{
                        //case when patterns array is present but not the negative KV pair
                        let tempArray = [];
                        tempArray.push(document.associatedPatternObj.pattern);
                        data.pattern[0].negativePattern = tempArray;
                    }
                } else{
                    //case when pattern attribute is not present
                    let tempArray = [];
                    let tempJSONObj = {};
                    tempJSONObj.negativePattern = [];
                    tempJSONObj.negativePattern.push(document.associatedPatternObj.pattern);
                    tempArray.push(tempJSONObj);
                    data.pattern = tempArray;
                }
            }
        }

        //pushing all positive and negative patterns into another KV pair (used for page filters) - TODO
        let tempArray = [];
        if(data.pattern && data.pattern[0] && data.pattern[0].positivePattern){
            for(const tempObj of data.pattern[0].positivePattern){
                tempArray.push(tempObj);
            }
        }
        if(data.pattern && data.pattern[0] && data.pattern[0].negativePattern){
            for(const tempObj of data.pattern[0].negativePattern){
                tempArray.push(tempObj);
            }
        }

        if(tempArray.length > 0){
            //no need to add checks on data and data.pattern[0] - as if tempArray has data these checks will always be true
            data.pattern[0].patternObjs = tempArray;
        }
        
        if(record.eventName === 'INSERT'){
            if(data.conversationCount){
                data.conversationCount = data.conversationCount + 1;
            }else{
                data.conversationCount = 1;
            }

            if(data.averageSentiment && data.conversationCount !== 1){
                //conversation count cannot be 1 - if count is 1, that means this is the first conversation so we want it to go into else condn
                data.averageSentiment = ((data.averageSentiment*(data.conversationCount-1)) + document.sentimentScore) / (data.conversationCount);
            }else{
                data.averageSentiment = document.sentimentScore ? document.sentimentScore : 0.0 ;
            }         
        }
        else if(record.eventName === 'MODIFY'){
            console.log("Inside MODIFY: ",JSON.stringify(data,null,3));
            //case of modify of the CONV row, right now only update in sentimentScore is being captured
            const oldConvData = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
            if(document.sentimentScore !== oldConvData.sentimentScore){
                data.averageSentiment = ((data.averageSentiment*data.conversationCount)+document.sentimentScore-oldConvData.sentimentScore)/data.conversationCount;
            }
        }

        //setting sentiment string value for the workflow
        if(data.averageSentiment < 2){
            data.sentiment = 'NEGATIVE';
        }else if(data.averageSentiment > 3){
            data.sentiment = 'POSITIVE';
        }else if(data.averageSentiment){
            data.sentiment = 'NEUTRAL';
        }else{
            data.sentiment = undefined;
        }

        console.log('document being pushed to campaigns index: ',JSON.stringify(data,null,3));
      await  axios.put(url + campaignRecordId, data, { auth: ElasticClusterConfigData.auth })
        .catch(function (error) {
            if (error.response) {
            console.log(error.response.data);
            console.log(error.response.status);
            console.log(error.response.headers);
            } else if (error.request) {
            console.log(error.request);
            } else {
            console.log('Error', error.message);
            }

        });
    }
    else{
        console.log('could not fetch campaign data corresponding to conversation with campaign id-',document.campaignId);
    }
  
}
