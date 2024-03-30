/**This file hosts all services for the REST Handles */
var _ = require('lodash');
const { ResponseFormatter, ERRORS } = require('@commonutils/formatter');
const { updateSingleStep, insertSingleStep,
    fetchStepFromDB,deleteStepsForWorkflowFromDB,
    deleteStepFromDB } = require('@dbutils/step');
const { getOrgAttribute } = require('@dbutils/org');
const { getStepsFromSearch, getDistinctStepttributeValues } = require('@searchutils/steps');

/**
 * Function to fetch Steps using WorkflowIg
 * @param {*} orgId 
 * @param {*} workflowId 
 * @returns 
 */
const fetchStepsForWorkflow = async function (orgId, workflowId) {
    console.debug(" fetchStepsForWorkflow ", orgId, " - ", workflowId);
    try {
        let searchCond = [{
            match: { 'workflowId.keyword': workflowId }
        },
        {
            match: { 'isDeleted': false }
        }
        ];
        console.debug(" fetchStepsForWorkflow searchCond ", JSON.stringify(searchCond));
        const response = await getStepsFromSearch(orgId, searchCond,null);
        console.log("FetchStepsForWorkflow, getStepsFromSearch response - ", response);
        if (response && response.length) {
            let returnData = response;
            //TODO - check if we need this
            // COMMENTING below sort because it is messing up the order of the questions sent to frontend
            //sort in the order of parent child relationship
            // returnData.sort((a, b) =>
            //     !a.parentStepId ? -1 : (!b.parentStepId ? 1 : (a.parentStepId == b.stepId ? 1 : -1))
            // );

            return ResponseFormatter(returnData);
        }
        return ResponseFormatter([]);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}
/**
* Function to fetch the steps from elastic search. Can be filtered based on 
* filter attributes
* @param {*} orgId 
* @param {*} options 
* @returns 
*/
const fetchStepsForOrg = async function (orgId, filterValues) {
    try {

        let searchCond = [];
        if (filterValues) {
            for (let [key, value] of Object.entries(filterValues)) {
                console.log(key, "-", value);
                let filterObj = {};
                filterObj[key] = value;
                let searchterm;
                if (key == 'questionText') {
                    searchterm = {
                        match_phrase_prefix: filterObj
                    };
                } else {
                    if (key == 'moment' || key == 'tags' || key =='createdBy') {
                        filterObj[key+".keyword"] = filterObj[key];
                        delete filterObj[key];
                        searchterm = {
                            match_phrase: filterObj
                        };
                    } else {
                        searchterm = {
                            match: filterObj
                        };
                    }

                }
                searchCond.push(searchterm);
            }
        }
        console.debug("fetchStepsForOrg searchCond " + JSON.stringify(searchCond));
        const response = await getStepsFromSearch(orgId, searchCond,null);


        return ResponseFormatter(response)
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }

}
/**
 * Function to fetch Steps using stepId
 * @param {*} orgId 
 * @param {*} stepId 
 * @returns 
 */
const fetchStepForId = async function (orgId, stepId) {

    try {
        const response = await fetchStepFromDB(orgId, stepId);
        if (response.Item) {
            return ResponseFormatter(response.Item);
        }
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}

/**
 * Function to fetch Steps using previousStepId
 * @param {*} orgId 
 * @param {*} previousStepId 
 * @returns 
 */
 const fetchStepForParentId = async function (orgId, previousStepId) {

    try {
        console.log("Inside fetchStepForParentId, previousStepId : "+ previousStepId + "orgId : "+ orgId);
        let searchCond = [
            {
              match: {
                "previousStepId.keyword": previousStepId
              }
            }
          ];
        
        let stepResponse = await getStepsFromSearch(orgId, searchCond);
        if (stepResponse) {
            console.log("fetchStepForParentId, response : "+ JSON.stringify(stepResponse));
            return ResponseFormatter(stepResponse);
        }
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}

/**
 * Function to insert Steps into Workflow
 * @param {*} orgId 
 * @param {*} workflowId 
 * @param {*} category 
 * @param {*} questionText 
 * @param {*} moment 
 * @param {*} area 
 * @param {*} options 
 * @param {*} sentiment 
 * @param {*} previousStepId 
 * @param {*} nextStepId 
 * @returns 
 */
const insertStepToWorkflow = async function (orgId, workflowId, category, questionText, momentId, moment, tags, sequence, options, sentiment, previousStepId, nextStepId, isDeleted, createdBy,isSentimentCaptured) {
    console.debug("insertStepToWorkflow");
    try {
        const response = await insertSingleStep(orgId, null, workflowId, category, questionText,momentId, moment, tags, sequence, options, sentiment, previousStepId, nextStepId, isDeleted, createdBy,isSentimentCaptured);
        return ResponseFormatter(response);
    } catch (error) {
        return ResponseFormatter(null, ERRORS.INTERNAL_ERROR);
    }
}


/**
 * Function to update Steps using stepId
 * @param {*} orgId 
 * @param {*} stepId 
 * @param {*} updateParams 
 * @returns 
 */
const updateStepToWorkflow = async function (orgId, stepId, updateParams) {
    console.log("updateStepToWorkflow, updateParams : ", updateParams);
    updateParams['stepId'] = stepId;

    try {
        const response =
            await Promise.all([
                updateSingleStep(orgId, stepId, updateParams),
            ]);
        return ResponseFormatter(response.Items)
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}

/**
 * Function to update Steps in bulk
 * @param {*} orgId 
 * @param {*} updateParams 
 * @returns 
 */
const updateInsertStepInBulk = async function (orgId, updateArray) {

    if (!updateArray || updateArray.length < 1) {
        console.error('Malformed Request');
        return ResponseFormatter(null, ERRORS.BAD_REQUEST);
    }

    try {
        let promiseArray = [];
        updateArray.forEach(
            async function (updateParams) {
                if (updateParams && updateParams.stepId) {
                    promiseArray.push(updateSingleStep(orgId, updateParams.stepId, updateParams));
                }
                // else {
                //     promiseArray.push(insertSingleStep(orgId, updateParams.workflowId, updateParams.questionText, updateParams.moment,
                //         updateParams.sequence, updateParams.options, updateParams.previousStepId, updateParams.nextStepId));
                // }
            }
        );
        const response = await Promise.all(promiseArray);
        return ResponseFormatter(response)
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }
}
/**
 * Function to update previousStepId for a given stepId
 * @param {*} orgId 
 * @param {*} previousStepId 
 * @param {*} stepId 
 * @returns 
 */
const updatepreviousStepId = async function (orgId, previousStepId, stepId) {

    if (stepId) {
        const parentUpdateParams = {
            previousStepId: previousStepId
        }
        await updateSingleStep(orgId, stepId, parentUpdateParams);

    }
    else {
        return Promise.resolve(false);
    }

}

/**
 * Function to update nextStepId for a given stepId
 * @param {*} orgId 
 * @param {*} nextStepId 
 * @param {*} stepId 
 * @returns 
 */
const updatenextStepId = async function (orgId, nextStepId, stepId) {
    if (stepId) {
        const childUpdateParams = {
            nextStepId: nextStepId
        }
        await updateSingleStep(orgId, stepId, childUpdateParams);

    }
    else {
        return Promise.resolve(false);
    }
}

/**
 * Function to delete existing Step
 * @param {*} orgId 
 * @param {*} stepId 
 * @returns 
 */
const deleteStepsFromWorkflow = async function (orgId, workflowId) {

    try {
        const response = await deleteStepsForWorkflowFromDB(orgId, workflowId);
        return ResponseFormatter(response);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }
}
/**
 * Function to delete existing Step
 * @param {*} orgId 
 * @param {*} stepId 
 * @returns 
 */
 const deleteStep = async function (orgId, stepId) {

    try {
        const response = await deleteStepFromDB(orgId, stepId);
        return ResponseFormatter(response.Items)
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }
}
/**
 * Fetch the unique fitlers for the questions
 * @param {*} orgId 
 * @returns 
 */
const fetchQuestionFilters = async function (orgId) {

    try {
        const getParams = 'questionAttributeMapping';
        console.log("Step Oper fetchQuestionFilters questionAttributeMapping " + orgId + " , " + getParams);
        const response = await getOrgAttribute(orgId, getParams);
        console.log(response);
        let returnArray = [];
        let promiseArray = [];
        let arrayIndex = 0;

        if (response.Item && response.Item.questionAttributeMapping) {

            for (const index in response.Item.questionAttributeMapping) {
                if (response.Item.questionAttributeMapping[index].filter) {
                    returnArray[arrayIndex] = response.Item.questionAttributeMapping[index];
                    promiseArray[arrayIndex] = getDistinctStepttributeValues(orgId, returnArray[arrayIndex].key);
                    arrayIndex++;
                }
            }

            const uniqueValuesArray = await Promise.all(promiseArray);

            for (const index in returnArray) {
                delete returnArray[index].filter;
                delete returnArray[index].column;
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

const getSearchCondition = async function (questData) {
    
    const { orgId, questionText, category,momentId,moment,sequence,tags, options, sentiment, previousStepId, nextStepId,isDeleted,createdBy,isSentimentCaptured} = questData;
    let searchWith = [];
    let searchWithout = [];
    if(orgId){
      searchWith.push({ term: { "orgId.keyword": orgId } });
    }
    if(questionText){
      searchWith.push({ term: { "questionText.keyword": questionText } });
    }
    if(category){
        searchWith.push({ term: { "category.keyword": category } });
    }
    if(moment){
      searchWith.push({ term: { "moment.keyword": moment } });
    }
    if(!moment){
      searchWithout.push({ exists: { "field": "moment" } });
    }
    if(isSentimentCaptured){
      searchWith.push({ term: { "isSentimentCaptured": isSentimentCaptured } });
    }
    console.log("searchWith - ", JSON.stringify((searchWith)));
    return [{
                        bool: {
                            filter: [...searchWith],
                            must_not: [...searchWithout]
                        }
                    },
                    {
                      term:{ 'isDeleted':false  }
                    }];
  }

module.exports = {
    fetchStepsForWorkflow,
    fetchStepForId,
    insertStepToWorkflow,
    updateStepToWorkflow,
    updateInsertStepInBulk,
    deleteStepsFromWorkflow,
    fetchStepsForOrg,
    fetchQuestionFilters,
    fetchStepForParentId,
    getSearchCondition
}
