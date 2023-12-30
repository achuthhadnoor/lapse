Flows

Initial user flow
_________________

- launch app -> ask for permission -> license window -> launch tray
- launch app -> launch tray
- ... launch tray -> click to see idle contextMenu
- ... idle menu - > check all the options are behaving as expected
  - start recording should call start recording and set tray icon, title and tooltip to recording.
    ___
    Settings
        - screenshot interval
        - Show Counter (2) => 2,3,4,5
        - show countdown
        - show timer (not implemented yet )
    Export options
        - Format ( mp4 )
        - Quality ( auto )
        - Framerate ( 30 )
    Output path
        - Ask before save ( should ask save path always before save if enabled )
        - .../documents/lapse_recordings ( click to change the default path )
    Help
        - Guide
        - Changelog
        - Feedback
    GiveTip
    Follow us
    Version (1.0.3)
    Auto launch
    Check for updates
    Quit

----------------------

start recording Flow
______________

- ... -> start recording -> window showing windows and screens -> select a window or screen -> click on record (active window will be in focus) [RECORDING ICON IN TRAY]
- ... -> refresh to fetch new screens/windows , X to close the window [NO CHANGE IN TRAY ICON]
- ... -> record button click [ if empty then disable it ]

-----------------------

Recording state
_______________

- click on tray icon -> pause the recording -> change icon to pause -> open the paused tray
  - Retake -> confirm dialog -> yes -> restarts the recording -> no stays in same paused state.
  - resume recording
  - stop recording -> stop recording -> rendering tray -> prepares the video -> saves the video
  - save path
  - ask where before save

-------------------------

Rendering state
_______________

- shows progress in the menubar initially set to 0.
