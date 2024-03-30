/**This file hosts all services for the REST Handles */
var _ = require('lodash');
const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const {WorkflowStatus,EventTypes,AWS_Account_Number,Lambda_Names} = require('@commonutils/constants');
const {createCloudWatchRule} = require('@commonutils/services');

const {
    fetchWorkflowFromDB,
    insertWorkflowToDB,
    updateWorkflowToDB,
    insertSingleStep,
    fetchStepsForWorkflowFromDB,
    deleteWorkflowFromDB,
    getStepId
} = require('@dbutils/workflow');

const {
    getExecutedWorkflowListFromSearch,
    getSurveyTemplatesFromSearch,
    getDistinctWorkflowAttributeValues
} = require('@searchutils/workflow');

const {getOrgAttribute} = require('@dbutils/org');


/**
 * Function to fetch the campaign Templates. Can be filtered based on 
 * global filter attributes
 * @param {*} orgId 
 * @param {*} options 
 * @returns 
 */
const getSurveyTemplates = async function (orgId, options) {
    try {
        const response = await getSurveyTemplatesFromSearch(orgId, options);
        return ResponseFormatter(response)
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }

}

/**
* Function to fetch the campaigns. The response can be filtered by options
* provided from the filer. It can also be paginated and sorted by any field.
* @param {*} orgId 
* @param {*} options - to be sorting and fitlering for the future
* @returns 
*/
const getExecutedWorkflowList = async function (orgId, filterValues) {
    try {
        let searchCond =[];
        if(filterValues){
            for (let [key, value] of Object.entries(filterValues)) {
                const parsedValue = JSON.parse(JSON.stringify(value));
                // console.log("KV: ",key,value,parsedValue,typeof parsedValue);
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
        console.log("Inside getExecutedWorkflowList() - Search condition ######### ", JSON.stringify(searchCond));
        let options = {searchCond : searchCond}
        const response = await getExecutedWorkflowListFromSearch(orgId, options);
        return ResponseFormatter(response);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }

}

/**
 * Function to fetch Workflow using workflowId
 * @param {*} orgId 
 * @param {*} workflowId 
 * @returns 
 */
const fetchWorkflowForId = async function (orgId, workflowId) {

    try {
        const response = await fetchWorkflowFromDB(orgId, workflowId);
        if (response) {
            return ResponseFormatter(response);
        }
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }
}

/**
 * Function to create workflow from template. This copies the workflows and the steps
 * @param {*} orgId
 * @param {*} workflowTemplateId
 * @param {*} updateParams
 * @returns
 */
const createWorkflowFromTemplate = async function (orgId, workflowTemplateId, updateParams) {

    if (!updateParams) {
        updateParams = {};
    }
    if(updateParams && updateParams.workflowId){    
        //removing workflowId from updateparams if present(case - updateparams = workflowObj passed from frontend)
        delete updateParams.workflowId;
    }

    try {
        let stepReturnArray = [];
        const workflowId = await insertWorkflowToDB(orgId, updateParams);

        const stepResponse = await fetchStepsForWorkflowFromDB(orgId, workflowTemplateId);


        let stepArray = stepResponse.Items;


        if (stepArray) {

            let newStepIds = new Map();

            stepArray.forEach(function (step) {
                newStepIds.set(
                    step.stepId,
                    getStepId(workflowId)
                );

            });

            let promiseArray = [];

            stepArray.forEach(function (step) {
                step.stepId = newStepIds.get(step.stepId);
                step.previousStepId = newStepIds.get(step.previousStepId);
                step.nextStepId = newStepIds.get(step.nextStepId);
                promiseArray.push(insertSingleStep(orgId, step.stepId, workflowId, step.stepText, step.journeyMoment,
                    step.area, step.options, step.sentiment, step.previousStepId, step.nextStepId));
                stepReturnArray.push(step);
            });

            stepIdArray = await Promise.all(promiseArray);

        }

        return ResponseFormatter({
            workflowId: workflowId,
            stepArray: stepReturnArray
        });
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }

}

/**
 * Function to update a workflow 
 * @param {*} orgId 
 * @param {*} workflowId 
 * @param {*} updateParams 
 * @returns 
 */
const updateWorkflow = async function (orgId, workflowId, updateParams) {

    try {
        const response = await updateWorkflowToDB(orgId, workflowId, updateParams);
        if(response){
            if(insertParams['status'] === WorkflowStatus.LAUNCHED){
                await makeCloudWatchEvent(orgId,insertParams);
            }
            return ResponseFormatter(response);
        }
        return ResponseFormatter(response);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}


/**
 * Function to insert a workflow 
 * @param {*} orgId 
 * @param {*} insertParams 
 * @returns 
 */
 const insertWorkflow = async function (orgId, insertParams) {

    try {
        const response = await insertWorkflowToDB(orgId,insertParams);
        if(response){
            if(insertParams['status'] === WorkflowStatus.LAUNCHED){
                insertParams['workflowId'] = response; //assign the workflow ID
                await makeCloudWatchEvent(orgId,insertParams);
            }
            return ResponseFormatter(response);
        }
        
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}

/**
 * Function to delete a NPS conversation entry from table
 * @param {*} orgId 
 * @param {*} workflowId 
 * @returns 
 */
const deleteWorkflow = async function (orgId, workflowId) {
    try {
        const response = await deleteWorkflowFromDB(orgId, workflowId);
        return ResponseFormatter(response.Items)
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}


/**
 * Fetch the unique filters for campaign list page
 * @param {*} orgId 
 * @returns 
 */
 const fetchWorkflowFilters = async function (orgId) {

    try {
        const getParams = 'campaignAttributeMapping';
        const response = await getOrgAttribute(orgId, getParams);
        let returnArray = [];
        let promiseArray = [];
        let arrayIndex = 0;

        if (response.Item && response.Item.campaignAttributeMapping) {

            for (const index in response.Item.campaignAttributeMapping) {
                returnArray[arrayIndex] = response.Item.campaignAttributeMapping[index];
                promiseArray[arrayIndex] = getDistinctWorkflowAttributeValues(orgId, returnArray[arrayIndex].key);
                arrayIndex++;
            }

            const uniqueValuesArray = await Promise.all(promiseArray);

            for (const index in returnArray) {
                returnArray[index].uniqueValues = _.compact(uniqueValuesArray[index].map(item => item[returnArray[index].key]));
            }
            console.log(returnArray)
            return ResponseFormatter(returnArray);
        }
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}

/**
 * Utility function to make the CW event to trigger JEP on required dates
 * @param {*} orgId 
 * @param {*} params 
 * @returns 
 */
const makeCloudWatchEvent = async function(orgId, params){
    try{
        //TODO - check if we should append ENV name to eventName or not
        let eventName = EventTypes.NEW_CAMPAIGN + '-' + orgId + '-' + params['workflowId'];
        let eventData = {
            eventType :  EventTypes.NEW_CAMPAIGN,
            orgId : orgId,
            workflowId : params['workflowId'],
            audience : params['audience'],
            parentWorkflowId : params['parentWorkflowId']
        };
        console.log("In makeCloudWatchEvent()");
        let targetResource = "arn:aws:lambda:us-east-1:" + AWS_Account_Number[process.env.ENV] + 
                                ":function:" + Lambda_Names.JEP + "-" + process.env.ENV;
        

        let startDateObj = new Date(params['startDate']);
        startDateObj = startDateObj.getTime();
        startDateObj = startDateObj + (2 * 60 * 1000); //adding 2 minutes to it
        let scheduleTime = new Date(startDateObj);
        scheduleTime = scheduleTime.toISOString();

        await createCloudWatchRule(eventName,eventData,targetResource,scheduleTime);
    } catch (error) {
        console.error(error);
    }    
};

module.exports = {
    fetchWorkflowForId,
    updateWorkflow,
    deleteWorkflow,
    createWorkflowFromTemplate,
    getExecutedWorkflowList,
    getSurveyTemplates,
    fetchWorkflowFilters,
    insertWorkflow
}
