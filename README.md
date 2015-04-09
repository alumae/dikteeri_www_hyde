Dikteeri
========

Dictate text in a web browser, using https://github.com/alumae/kaldi-gstreamer-server 
as a speech recognition back-end.

Building
--------

To generate and publish Estonian site:

    hyde gen -c prod.yaml -r
    hyde publish -c prod.yaml

To generate and publish English site:

    hyde gen -c prod_en.yaml -r
    hyde publish -c prod_en.yaml

After adding a to-be-translated string in a HTML or Javascript file, extract the
strings:
    
    PYTHONPATH=. pybabel extract -F babel.cfg -o strings/messages.pot .
  
Update the translation templates:

    pybabel update -i ./strings/messages.pot -d ./strings
    
Translate the strings using `poedit`:

    poedit strings/en/LC_MESSAGES/messages.po
    
Compile translation tables:

    pybabel compile -f -d ./strings
    
Then, generate and publish new sites.
    
Demo
----

This code is used for Estonian browser-based dictation: http://bark.phon.ioc.ee/dikteeri/.

An English version that uses acoustic models trained on TEDLIUM data is available at http://bark.phon.ioc.ee/dictate/.
