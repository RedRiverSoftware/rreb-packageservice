//
// rreb-packageservice - packages Windows Services into Web Deploy packages
// part of the rreb (Red River Elastic Beanstalk) toolset
//
// Copyright (c) Red River Software Ltd.  All rights reserved.
// http://river.red/
//
// This source code is made available under the terms of the MIT General License.
//
'use strict';

module.exports = function(grunt) {
	
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		
		"rreb-packageservice": {
	        options: {
				// version displayed on the /status.aspx page, which also shows service status
	            version: '<%= pkg.version %>',
				
				// relative working folder, used for intermediate files produced
	            workingPath: 'service_temp',
				
				// name of web deploy package, placed into workingPath folder
				outputPackage: 'pkg.zip',
				
				// file name of the service executable
	            exeName: 'TestService.exe',
				
				// name of the service, used to install/start/uninstall/stop the service
	            svcName: 'Test Service',
				
				// any environment variables which should be set on the EB VM
				envVars: {
					MY_ENV_VAR: 'Test'
				}
	        },
	        svc: {
				// folder containing the windows service build output
				// (status.aspx is also placed in here by the task)
	            src: 'build_output'
	        }
	    }});
		
    grunt.loadTasks('tasks');
	grunt.registerTask('test', ['rreb-packageservice:svc']);
	
};
