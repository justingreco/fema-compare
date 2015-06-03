<?php
    $email = $_REQUEST['email'];
    $name = $_REQUEST['name'];
    $type = $_REQUEST['type'];
    $location = $_REQUEST['location'];
    $feedback = $_REQUEST['feedback'];
    $id = $_REQUEST['id'];

		$date = date("F jS Y, h:i a");
		$headers = 'MIME-Version: 1.0' . "\r\n" .
			"Content-type: text/html; charset=iso-8859-1\r\n" .
			'From: rezoning@raleighnc.gov' . "\r\n" .
			'Reply-To: rezoning@raleighnc.gov' . "\r\n" .
			'Bcc: rezoning@raleighnc.gov' . "\r\n" .
			'X-Mailer: PHP/' .phpversion();

		$message = '
		<html>
			<head>
				<title>City of Raleigh Feedback Ref #'.$id.'</title>
			</head>
			<body style="font-family: arial">
				<p>Thanks for your feedback on the draft rezoning map.  We appreciate your help with this process and will respond to you as soon as we can (generally within 2 business days).</p>
				<hr/>
				Feedback Received '.$date.'<br/>
				Reference #: '.$id.'<br/>
        		Location: '.$location.'<br/>
        		Comment Type: '.$type.'<br/>
        		Comment: '.$feedback.'<br/>
        		<hr/>
        		<p>Thanks for your time,</p>
        		<p></p>
        		<b>City of Raleigh Remapping Team</b><br/>
        		Email: rezoning@raleighnc.gov<br/>
        		Web: www.RaleighUDO.us<br/>
        		Phone: 919.996.6363 (8am-5pm, Mon-Fri)<br/>
			</body>
		</html>
		';
		mail($email, "City of Raleigh Feedback Ref #".$id, $message, $headers);
?>
