const { getSearchQuery } = require("@commonutils/search");
const { getAggregationQuery, getAggregateResponse } = require("@commonutils/aggregate");
const { Entities } = require("@commonmodels/elastic");
const { GetElasticClient, ElasticIndices } = require('@searchutils/models');

/**
 * Service function which holds business logic to perform aggregated queries on workflow index.
 * @param {string} orgId
 * @param {*} options
 * @returns
 */
const getAggregatedResults = async (orgId, filterOptions, periodFilter, aggregateOptions) => {
  let searchQuery;
  if(filterOptions){
    if(filterOptions.filters.length>0 || filterOptions?.mustNotFilters){
    searchQuery = getSearchQuery(Entities.workflows, filterOptions);
    }
  }
 
  const aggregationQuery = getAggregationQuery(Entities.workflows, aggregateOptions);
  const elasticQuery = {
    aggs: aggregationQuery
  };

  if(searchQuery){
    elasticQuery['query'] = searchQuery.query
  }
  console.info(JSON.stringify(elasticQuery));
  const elasticClient =await GetElasticClient();
  const elasticResponse = await elasticClient.search({
    index: ElasticIndices.workflows,
    body: elasticQuery
  });
  return getAggregateResponse(aggregateOptions, elasticResponse);
};

module.exports = {
  getAggregatedResults
};