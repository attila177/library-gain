# Library Gain
Graphical tool that analyzes mp3 files in a folder and applies volume normalization to them, overwriting the original files. The base of the source code was generated using ChatGPT 4. Main dependencies: electron, react, ffmpeg

# original prompt

```
Can you generate me a zip file containing the source code for a functioning software project called "library gain", with the following properties:

* it can be used in windows 11
* the used dependencies are relatively popular and still maintained
* it has a GUI
* in the GUI, you pick a folder
* if a folder was picked, all mp3 files within the folder are displayed in a table
* when a folder is picked, an analysis of the files is carried out so the table can be filled with information
* for each file whose analysis is completed, the information is displayed in the table even before the analysis of all files is completed
* the table has the columns "file name", "file size", "modified date", "replay gain metadata", "average decibel", "maximum decibel"
* the table can be sorted for ascendingly and descendingly for any of the columns by clicking the respective cell in the header column
* the user can select multiple files
* there is a input field for "target decibel"
* there is a button for carrying out the "normalizing" action for selected files, which adjusts the volume of the mp3 file to the value of "target decibel", overwriting the original file
* ideally you choose a programming language that is both suitable to the task and that I can understand well. my skills are: very good at typescript, very good at javascript, good at java, not so good at golang and python
```

# Changelog
* `album` and `independent` modes for calculation of which dB change should be applied to each file
