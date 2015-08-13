<?php
    $email = $_REQUEST['email'];
    $name = $_REQUEST['name'];
    $type = $_REQUEST['type'];
    $location = $_REQUEST['location'];
    $feedback = $_REQUEST['feedback'];
    $id = $_REQUEST['id'];
    $contact = $_REQUEST['contact'];

		$date = date("F jS Y, h:i a");
		$headers = 'MIME-Version: 1.0' . "\r\n" .
			"Content-type: text/html; charset=iso-8859-1\r\n" .
			'From: gis@raleighnc.gov' . "\r\n" .
			'Reply-To: gis@raleighnc.gov' . "\r\n" .
			'Bcc: ' .$contact . "\r\n" .
			'X-Mailer: PHP/' .phpversion();

		$message = '
		<html>
			<head>
				<title>Floodplain Feedback Ref #'.$id.'</title>
			</head>
			<body style="font-family: arial">
				<p>Thank you for your feedback. Your comments have been forwarded to the
					appropriate local government floodplain administrator</p>
				<hr/>
				Feedback Received '.$date.'<br/>
				Reference #: '.$id.'<br/>
        		Location: '.$location.'<br/>
        		Comment: '.$feedback.'<br/>
        		Commenter: '.$name.'<br/>
        		Commenter Email: '.$email.'<br/>
        		<hr/>
        		<p>Thanks for your time,</p>
        		<p></p>
        		<b>Wake County Environmental Services</b><br/>
        		Email: iMAPSHelpDesk@wakegov.com<br/>
        		Web: www.RaleighUDO.us<br/>
        		Phone: 919.XXX.XXXX<br/>
			</body>
		</html>
		';
		mail($email, "Floodplain Feedback Ref #".$id, $message, $headers);

?>
