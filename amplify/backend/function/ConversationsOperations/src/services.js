/**This file hosts all services for the REST Handles */
const {
    ResponseFormatter, ERRORS
} = require('@commonutils/formatter');

var _ = require('lodash');

const { getOrgAttribute} = require('@dbutils/org');

const { getDistinctConversationAttributeValues, getFilteredConversations,
    getFilteredResponses, getSentimentDataForMomentsQuery } = require('@searchutils/conversations');
 

/**
 * Fetch the unique fitlers for the conversation
 * @param {*} orgId 
 * @returns 
 */
const fetchConversationFilters = async function (orgId, filterApplied) {

    try {
        const getParams = 'conversationAttributeMapping';
        const response = await getOrgAttribute(orgId, getParams);
        let returnArray = [];
        let promiseArray = [];
        let arrayIndex = 0;

        if (response.Item && response.Item.conversationAttributeMapping) {

            for (const index in response.Item.conversationAttributeMapping)
            {
                if(response.Item.conversationAttributeMapping[index].filter)
                {
                   returnArray[arrayIndex] = response.Item.conversationAttributeMapping[index];
                   promiseArray[arrayIndex] =  getDistinctConversationAttributeValues(orgId,returnArray[arrayIndex].key, filterApplied);
                   arrayIndex++;
                }   
            }
            
            const uniqueValuesArray = await Promise.all(promiseArray);

            for (const index in returnArray)
            {
                delete returnArray[index].filter;
                delete returnArray[index].column;
                returnArray[index].uniqueValues = _.compact(uniqueValuesArray[index].map(item => item[returnArray[index].key]));
            }

            return ResponseFormatter(returnArray);
        }
        //returning blank list if no org level attribute set for "conversationAttributeMapping"
        return ResponseFormatter(returnArray);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}

/**
 * Function the filtered set of conversations
 * @param {*} orgId 
 * @param {*} requestBody 
 * @returns 
 */
 const fetchFilteredConversations = async function (orgId, requestBody, size) {

    try {
        // const getParams = 'conversationAttributeMapping';
       // <Only get columns we need TODO when we fetch from dynamo> const response = await getOrgAttribute(orgId, getParams);
        let searchCond = [];
        var filterValues = requestBody.filter;
        var sortCondition;
        if(requestBody.sortColumn){
            sortCondition = requestBody.sortColumn;
        }
        
        if(filterValues)
        {
            for (let [key, value] of Object.entries(filterValues)) {
          
      
          const parsedValue = value;
          let searchterm;
          
          if(parsedValue.length)
          {
              let shouldTerm =[];
              parsedValue.forEach(element=>{
                  let matchObject={};
                  
                   matchObject[key+".keyword"] = element;
                   shouldTerm.push({
                         match: matchObject
                   });
              });
              
              searchterm = {
                 bool: {
                     should: shouldTerm
                 }
            }
              
              
          }
          else
          {
              let matchObject={};
              matchObject[key+".keyword"]= parsedValue ;
                searchterm = {
                 match: matchObject
                 }
              
          }
         
          searchCond.push(searchterm);
         }
        }
        
        // console.log("Search condition ######### ", JSON.stringify(searchCond));

          // call function to get attributes required for conversation from conversation index
        const returnData = await getFilteredConversations(orgId, searchCond , size);
        // console.log("Return Data: ");
        // console.log(returnData.sentiment,returnData.score,returnData.total,returnData.distinctUsers);
        // console.log(JSON.stringify(returnData.sentimentByDay,null,3));
        // console.log(JSON.stringify(returnData.sentimentByMonth,null,3));
        // console.log(JSON.stringify(returnData.sentimentByQuarter,null,3));
        // console.log(JSON.stringify(returnData.sentimentByYear,null,3));

        let promiseArray = [];
        let index = 0;
        
        returnData.forEach(element => {
            const respSearch = [
                {
                    match:  { conversationId : element.conversationId}
                }
            ];
            
            promiseArray[index] =  getFilteredResponses (orgId,respSearch);
            index ++;
        });
        
       const sentiment = returnData.sentiment;
       
       const total = returnData.total;
       const sentimentByMonth = [];
       const sentimentByYear = [];
       const sentimentByQuarter = [];
       const sentimentByDay = [];
       if(sentimentByMonth){
            let data = returnData.sentimentByMonth.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByMonth.push({[key] : value.averageScore.value.toFixed(1)})
                }
            }
       }
       if(sentimentByYear){
            let data = returnData.sentimentByYear.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByYear.push({[key] : value.averageScore.value.toFixed(1)})
                }
            }
        }
        if(sentimentByDay){
            let data = returnData.sentimentByDay.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByDay.push({[key]: value.averageScore.value.toFixed(1)})
                }
            }
        }
        if(sentimentByQuarter){
            let data = returnData.sentimentByQuarter.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByQuarter.push({[key]:value.averageScore.value.toFixed(1)})
                }
            }
        }

        let uniqueResponseCount = 0;
        if(returnData.distinctUsers){
            uniqueResponseCount = returnData.distinctUsers.length;
        }

        let score = 0;
       
       if(returnData.score)
       {
            score = returnData.score.toFixed(1);
       }
      

        const uniqueValuesArray = await Promise.all(promiseArray);
        index = 0;
        uniqueValuesArray.forEach(element => {
            returnData[index].conversation = [];
            element.forEach(rawResponse => {
                
                returnData[index].conversation.push({
                    question: rawResponse.questionText,
                    response: rawResponse.questionResponse
                })
            });
            index++;

        });

        if(sortCondition){
            sortByColumn = sortCondition.column;
            sortOrder = sortCondition.order;
        }
        let sortFilters = [];
        let sortOrders = [];
        sortFilters.push(sortByColumn);
        sortOrders.push(sortOrder);
    
        finalData = _.orderBy(returnData, sortFilters, sortOrders);

        return ResponseFormatter({
            conversations: finalData,
            sentiment : sentiment,
            total: total,
            score: score,
            uniqueResponseCount: uniqueResponseCount,
            sentimentByDay: sentimentByDay,
            sentimentByQuarter: sentimentByQuarter,
            sentimentByMonth: sentimentByMonth,
            sentimentByYear: sentimentByYear
        });
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}


/**
 * function to get responses data aggregated for list of moments passed
 * @param {*} orgId 
 * @param {*} requestBody 
 * @returns 
 */
 const getSentimentDataForMoments = async function (orgId, requestBody) {

    try {
        let searchCond = [],matchMomentsQuery = [];
        var filterValues = requestBody.filter;
        var momentIds = requestBody.momentIds;
        
        if(filterValues)
        {
            for (let [key, value] of Object.entries(filterValues)) {        
                const parsedValue = value;
                let searchterm;
            
                if(parsedValue.length){
                    let shouldTerm =[];
                    parsedValue.forEach(element=>{
                        let matchObject={};
                        
                        matchObject[key+".keyword"] = element;
                        shouldTerm.push({
                                match: matchObject
                        });
                    });
                    
                    searchterm = {
                        bool: {
                            should: shouldTerm
                        }
                    }               
                }
                else{
                    let matchObject={};
                    matchObject[key+".keyword"]= parsedValue ;
                    searchterm = {
                        match: matchObject
                    }
                }
                searchCond.push(searchterm);
            }
        }

        if(momentIds){
            //if there are any moment IDs in this list, then 
            let queryBuilderString = [];
            for(const tempObj of momentIds){
                let tempJSONObj = {};
                tempJSONObj.term = {};
                tempJSONObj.term["momentId.keyword"] = {
                    "value" : tempObj
                };
                queryBuilderString.push(tempJSONObj);
            }
            matchMomentsQuery = queryBuilderString;
        }
        
        // call function to get attributes required for conversation from conversation index
        const returnData = await getSentimentDataForMomentsQuery(orgId, searchCond,matchMomentsQuery);
        // console.log("Inside getSentimentDataForMoments() - return Data: ",returnData);
        const sentiment = returnData.sentiment;
        const total = returnData.total;

        const sentimentByMonth = [];
        const sentimentByYear = [];
        const sentimentByQuarter = [];
        const sentimentByDay = [];
        if(sentimentByMonth){
            let data = returnData.sentimentByMonth.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByMonth.push({[key] : value.averageScore.value.toFixed(1)})
                }
            }
       }
       if(sentimentByYear){
            let data = returnData.sentimentByYear.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByYear.push({[key] : value.averageScore.value.toFixed(1)})
                }
            }
        }
        if(sentimentByDay){
            let data = returnData.sentimentByDay.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByDay.push({[key]: value.averageScore.value.toFixed(1)})
                }
            }
        }
        if(sentimentByQuarter){
            let data = returnData.sentimentByQuarter.buckets;
            for (const [key, value] of Object.entries(data)) {
                if(value && value.averageScore && value.averageScore.value){
                    sentimentByQuarter.push({[key]:value.averageScore.value.toFixed(1)})
                }
            }
        }

        let uniqueResponseCount = 0;
        if(returnData.distinctUsers){
            uniqueResponseCount = returnData.distinctUsers.length;
        }

        let score = 0;
        if(returnData.score){
            score = returnData.score.toFixed(1);
        }

        return ResponseFormatter({
            sentiment : sentiment,
            total: total,
            score: score,
            uniqueResponseCount: uniqueResponseCount,
            sentimentByDay: sentimentByDay,
            sentimentByQuarter: sentimentByQuarter,
            sentimentByMonth: sentimentByMonth,
            sentimentByYear: sentimentByYear
        });
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}


module.exports = {
    fetchConversationFilters,
    fetchFilteredConversations,
    getSentimentDataForMoments
}