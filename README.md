# rreb
Elastic Beanstalk deployment/management tools

by Red River Software (http://river.red)

MIT Licensed

**rreb-packageservice**

Takes a Windows Service and associated files, and builds into a Web Deploy package.  When deployed, any existing version of the service will be stopped and uninstalled; custom environment variables can be set; the new version is installed and started.  Accessing /status.aspx on the deployment target will show the deployed version, service name and current service status.
