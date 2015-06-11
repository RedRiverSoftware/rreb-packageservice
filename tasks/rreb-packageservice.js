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

    var child_process = require('child_process');
    var jszip = require('jszip');
    var path = require('path');
    var fs = require('fs');
    
    grunt.registerMultiTask('rreb-packageservice', 'Packages a Windows Service into an Elastic Beanstalk archive', function () {
        
        var srcPath = path.resolve(this.data.src);
        
        // combine task and target options into one object (allows for overriding)
        var defaults = {
            vm_installutil_path: 'c:\\windows\\microsoft.net\\framework\\v4.0.30319\\installutil',
            local_msdeploy_path: 'C:\\Program Files\\IIS\\Microsoft Web Deploy V3\\msdeploy.exe'
        };
        var taskOpts = grunt.config(['rreb-packageservice', 'options']) || {};
        var targetOpts = grunt.config(['rreb-packageservice', this.target, 'options']) || {};
        var options = grunt.util._.merge({}, defaults, taskOpts, targetOpts);
        
        // validate required parameters
        if (!options.version) {
            throw new Error('`version` required - to be displayed on /status.aspx page');
        }
        if (!options.workingPath) {
            throw new Error('`workingPath` required - folder used for temp files and output package');
        }
        if (!options.outputPackage) {
            throw new Error('`outputPackage` required - file name for resulting package zip file (goes in workingPath)');
        }
        if (!srcPath) {
            throw new Error('`src` required - folder containing windows service build output');
        }
        if (!options.exeName) {
            throw new Error('`exeName` required - executable file for service in source folder');
        }
        if (!options.svcName) {
            throw new Error('`svcName` required - name of the windows service');
        }

        // make working folder, remove any existing output packages or temp files
        var packageDir = path.resolve(options.workingPath);
        if (!fs.existsSync(packageDir)) {
            fs.mkdirSync(packageDir);
        }
        var packagePath = packageDir + '/' + options.outputPackage;
        if (fs.existsSync(packagePath)) {
            fs.unlinkSync(packagePath);
        }
        var manifestPath = packageDir + '/pkg-manifest.xml';
        if (fs.existsSync(manifestPath)) {
            fs.unlinkSync(manifestPath);
        }
        var indexPath = srcPath + '/status.aspx';
        if (fs.existsSync(indexPath)) {
            fs.unlinkSync(indexPath);
        }

        // build a /status.aspx page which shows the service status at the EB URL
        var indexHtml = '<%@ Page Language="C#" %><%@ Assembly Name="System.ServiceProcess, Version=4.0.0.0, Culture=neutral, PublicKeyToken=B03F5F7F11D50A3A" %>'
        + '<html><head><title>Service Status</title></head><body><h2>Deployed Version: ' + grunt.config('pkg').version
        + '</h2><h2>Service Status: ' + options.svcName
        + '</h2><p>Status: <% try { Response.Write(new System.ServiceProcess.ServiceController("' + options.svcName + '").Status); } catch (Exception ex) { Response.Write("Unknown: " + ex.ToString()); } %>'
        + '</p></html>';
        fs.writeFileSync(indexPath, indexHtml);

        // build a custom Web Deploy manifest
        var manifestXml = '<?xml version="1.0" encoding="utf-8"?>\n';
        manifestXml += '<sitemanifest>\n';
        
        // stop then uninstall any existing version of the service.  note, uses the new executable to do the uninstall.
        // if you're using the standard service installer method, this works just fine
        manifestXml += '  <runCommand path="net stop ' + options.svcName + '" successReturnCodes="0x0;0x2" waitInterval="60000" />\n';
        manifestXml += '  <runCommand path="' + options.vm_installutil_path + ' /u c:\\inetpub\\wwwroot\\' + options.exeName + '" waitInterval="30000" />\n';
        
        // basic access configuration (note: anonymous access for all files - use EC2 security groups to control access!)
        manifestXml += '  <IisApp path="' + srcPath + '" managedRuntimeVersion="v4.0" />\n';
        manifestXml += '  <setAcl path="' + srcPath + '" setAclResourceType="Directory" />\n';
        manifestXml += '  <setAcl path="' + srcPath + '" setAclUser="anonymousAuthenticationUser" setAclResourceType="Directory" />\n';

        // add call to 'setx' to set machine-wide environment variables
        var envVars = options.envVars;
        if (envVars) {
            for (var key in envVars) {
                if (envVars.hasOwnProperty(key)) {
                    var val = envVars[key];
                    manifestXml += '  <runCommand path="setx &quot;' + key + '&quot; &quot;' + val + '&quot; /M" successReturnCodes="0x0" waitInterval="10000" />\n';
                }
            }
        }
        
        // finally install the new version of the service and start it
        manifestXml += '  <runCommand path="' + options.vm_installutil_path + ' c:\\inetpub\\wwwroot\\' + options.exeName + '" successReturnCodes="0x0" waitInterval="30000" />\n';
        manifestXml += '  <runCommand path="net start ' + options.svcName + '" successReturnCodes="0x0" waitInterval="30000" />\n';
        manifestXml += '</sitemanifest>';
        fs.writeFileSync(manifestPath, manifestXml);

        // build a parameters.xml as required for the package
        var packageDirRegex = srcPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        var parametersXml = '<parameters>\n';
        parametersXml += '  <parameter name="IIS Web Application Name" defaultValue="Default Web Site" tags="IisApp">\n';
        parametersXml += '    <parameterEntry kind="ProviderPath" scope="IisApp" match="^' + packageDirRegex + '$" />\n';
        parametersXml += '    <parameterEntry kind="ProviderPath" scope="setAcl" match="^' + packageDirRegex + '$" />\n';
        parametersXml += '  </parameter>\n';
        parametersXml += '</parameters>';

        // invoke msdeploy to produce the output package
        var res = child_process.execSync('"' + options.local_msdeploy_path + '" ' +
            '-source:manifest="' + manifestPath + '" ' +
            '-dest:package="' + packagePath + '" ' +
            '-verb:sync'
        );
        
        // use jszip to insert parameters.xml into the package
        var pkg = new jszip(fs.readFileSync(packagePath));
        pkg.file('parameters.xml', parametersXml);
        var zipBuf = pkg.generate({ type: 'nodebuffer' });
        fs.writeFileSync(packagePath, zipBuf);
    });

};
