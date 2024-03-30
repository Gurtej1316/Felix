/**This file hosts all services for the REST Handles */
const {
    ResponseFormatter, ERRORS
} = require('@commonutils/formatter');

var _ = require('lodash');

const { getOrgAttribute } = require('@dbutils/org');

const { getDistinctActionAttributeValues , getFilteredActions } = require('@searchutils/actions');
 
/**
 * Fetch the unique fitlers for the action
 * @param {*} orgId 
 * @returns 
 */
const fetchActionFilters = async function (orgId) {

    try {
        const getParams = 'actionAttributeMapping,isActionCalendarViewDefault';
        // console.log("chkpt2");
        const response = await getOrgAttribute(orgId, getParams);
        // console.log("chkpt3",response);
        let returnArray = [];
        let promiseArray = [];
        let arrayIndex = 0;

        if (response.Item && response.Item.actionAttributeMapping) {

            for (const index in response.Item.actionAttributeMapping)
            {
                if(response.Item.actionAttributeMapping[index].filter)
                {
                   returnArray[arrayIndex] = response.Item.actionAttributeMapping[index];
                   promiseArray[arrayIndex] =  getDistinctActionAttributeValues(orgId,returnArray[arrayIndex].key);
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

            let isActionCalendarViewDefault = false; //default value is false if the value is undefined
            if(response.Item.isActionCalendarViewDefault){
                isActionCalendarViewDefault = response.Item.isActionCalendarViewDefault;
            }
            
            return ResponseFormatter({
                actionFilters : returnArray,
                isActionCalendarViewDefault : isActionCalendarViewDefault
            });
        }
        //returning error but can change to a default mapping in the future if requirement changes
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}

/**
 * Function the filtered set of actions
 * @param {*} orgId 
 * @param {*} filterValues 
 * @returns 
 */
 const fetchFilteredActions = async function (orgId, filterValues) {

    try {
        let searchCond =[];
        if(filterValues){
            for (let [key, value] of Object.entries(filterValues)) {
                const parsedValue = JSON.parse(value);
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
        
        console.log("Inside fetchFilteredActions() - Search condition ######### ", JSON.stringify(searchCond));

        // call function to get attributes required for action from action index
        const returnData = await getFilteredActions(orgId,searchCond);
        console.log("Inside fetchFilteredActions() - Return Data ", returnData);
        return ResponseFormatter({
            actions:returnData
        });

    } catch (error) {
        console.error(error);
        return ResponseFormatter(null, ERRORS.NOT_FOUND);
    }

}


module.exports = {
    fetchActionFilters,
    fetchFilteredActions
}
