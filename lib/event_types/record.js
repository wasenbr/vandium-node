'use strict';

const helper = require( './helper' );

const TypedHandler = require( './typed' );

function createHandler( type, ...args ) {

    return new TypedHandler( type, helper.extractOptions( args ) )
        .eventProcessor( (event) => event.Records )
        .handler( helper.extractHandler( args ) )
        .createLambda();
}

module.exports = createHandler;
